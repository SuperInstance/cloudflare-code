/**
 * Main LLM Orchestration Engine
 * Coordinates all components for intelligent LLM request routing and management
 */

import { EventEmitter } from 'eventemitter3';
import { ModelRegistry } from '../models/registry.js';
import { LLMRouter } from '../router/router.js';
import { PromptEngine } from '../prompts/engine.js';
import { ResponseAggregator } from '../aggregation/aggregator.js';
import { CostOptimizer } from '../cost/optimizer.js';
import { RateLimiter } from '../rate/limiter.js';
import {
  LLMRequest,
  LLMResponse,
  LLMOrchestrationConfig,
  LLMProvider,
  RoutingOptions,
  AggregationConfig,
  BudgetConfig,
  RateLimitQuota,
  LLMOrchestrationError,
  ModelUnavailableError,
  RateLimitExceededError,
  BudgetExceededError,
} from '../types/index.js';

// ============================================================================
// Orchestration Engine Configuration
// ============================================================================

export interface OrchestrationEngineConfig {
  enableRouting: boolean;
  enableAggregation: boolean;
  enablePromptEngine: boolean;
  enableCostTracking: boolean;
  enableRateLimiting: boolean;
  enableCaching: boolean;
  defaultRoutingStrategy: string;
  defaultAggregationMethod: string;
  cacheTTL: number;
  maxRetries: number;
  timeout: number;
}

// ============================================================================
// Orchestration Engine
// ============================================================================

export class LLMOrchestrationEngine {
  private registry: ModelRegistry;
  private router: LLMRouter;
  private promptEngine: PromptEngine;
  private aggregator: ResponseAggregator;
  private costOptimizer: CostOptimizer;
  private rateLimiter: RateLimiter;
  private events: EventEmitter;
  private config: Required<OrchestrationEngineConfig>;
  private providerClients: Map<LLMProvider, any>;

  constructor(
    orchestrationConfig: Partial<OrchestrationEngineConfig> = {},
    llmConfig: Partial<LLMOrchestrationConfig> = {}
  ) {
    this.config = {
      enableRouting: orchestrationConfig.enableRouting ?? true,
      enableAggregation: orchestrationConfig.enableAggregation ?? true,
      enablePromptEngine: orchestrationConfig.enablePromptEngine ?? true,
      enableCostTracking: orchestrationConfig.enableCostTracking ?? true,
      enableRateLimiting: orchestrationConfig.enableRateLimiting ?? true,
      enableCaching: orchestrationConfig.enableCaching ?? true,
      defaultRoutingStrategy: orchestrationConfig.defaultRoutingStrategy || 'capability',
      defaultAggregationMethod: orchestrationConfig.defaultAggregationMethod || 'weighted',
      cacheTTL: orchestrationConfig.cacheTTL || 3600000,
      maxRetries: orchestrationConfig.maxRetries || 3,
      timeout: orchestrationConfig.timeout || 30000,
    };

    this.events = new EventEmitter();
    this.providerClients = new Map();

    // Initialize components
    this.registry = new ModelRegistry();
    this.router = new LLMRouter(this.registry, {
      defaultStrategy: this.config.defaultRoutingStrategy as any,
      enableCaching: this.config.enableCaching,
    });
    this.promptEngine = new PromptEngine({
      enableOptimization: true,
      cacheEnabled: this.config.enableCaching,
    });
    this.aggregator = new ResponseAggregator({
      defaultMethod: this.config.defaultAggregationMethod as any,
      enableQualityScoring: true,
    });
    this.costOptimizer = new CostOptimizer({
      enableTracking: this.config.enableCostTracking,
      enableBudgetEnforcement: true,
    });
    this.rateLimiter = new RateLimiter({
      enableRateLimiting: this.config.enableRateLimiting,
      enableThrottling: true,
    });

    this.setupEventForwarding();
  }

  // ========================================================================
  // Main Execution Methods
  // ========================================================================

  public async execute(
    request: LLMRequest,
    options: {
      routing?: RoutingOptions;
      aggregation?: AggregationConfig;
      userId?: string;
      priority?: number;
      multiModel?: boolean;
    } = {}
  ): Promise<LLMResponse> {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      this.events.emit('request:start', { requestId, request });

      // Check rate limits
      if (this.config.enableRateLimiting) {
        await this.checkRateLimits(request, options.userId);
      }

      // Check budgets
      if (this.config.enableCostTracking) {
        await this.checkBudgets(request, options.userId);
      }

      // Route request
      let routingDecision;
      if (this.config.enableRouting) {
        routingDecision = await this.router.route(request, options.routing);
        this.events.emit('routing:decision', { requestId, decision: routingDecision });

        // Update request with selected model
        if (!request.model) {
          request.model = routingDecision.model;
        }
      }

      // Execute request
      let response: LLMResponse;

      if (options.multiModel && this.config.enableAggregation) {
        response = await this.executeMultiModel(request, options.aggregation);
      } else {
        response = await this.executeSingle(request, options.userId, options.priority);
      }

      // Track cost
      if (this.config.enableCostTracking) {
        await this.trackCost(request, response, options.userId);
      }

      const duration = Date.now() - startTime;
      this.events.emit('request:complete', { requestId, response, duration });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.events.emit('request:error', { requestId, error, duration });
      throw error;
    }
  }

  private async executeSingle(
    request: LLMRequest,
    userId?: string,
    priority = 0
  ): Promise<LLMResponse> {
    const model = request.model;
    if (!model) {
      throw new LLMOrchestrationError(
        'No model specified',
        'NO_MODEL_SPECIFIED'
      );
    }

    // Check model availability
    const modelInfo = this.registry.getModel(model);
    if (!modelInfo || modelInfo.status !== 'available') {
      throw new ModelUnavailableError(model);
    }

    // Get provider client
    const provider = this.extractProvider(model);
    const client = this.providerClients.get(provider);

    if (!client) {
      throw new LLMOrchestrationError(
        `No client registered for provider: ${provider}`,
        'PROVIDER_NOT_FOUND'
      );
    }

    // Execute with rate limiting
    return this.rateLimiter.executeWithRateLimit(
      provider,
      () => client.chat(request),
      0,
      priority
    );
  }

  private async executeMultiModel(
    request: LLMRequest,
    aggregationConfig?: AggregationConfig
  ): Promise<LLMResponse> {
    // Select multiple models
    const models = this.selectModelsForAggregation(request, 3);

    // Execute requests in parallel
    const promises = models.map(async (model) => {
      const modelRequest = { ...request, model };
      return this.executeSingle(modelRequest);
    });

    const responses = await Promise.all(promises);

    // Aggregate responses
    const aggregated = await this.aggregator.aggregate(
      responses,
      aggregationConfig || {
        method: 'weighted',
        strategy: 'best',
      }
    );

    // Convert aggregated response back to LLMResponse format
    return {
      id: this.generateRequestId(),
      model: 'aggregated',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: aggregated.response,
          },
          finishReason: 'stop',
        },
      ],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      created: Date.now(),
      metadata: {
        aggregated,
      },
    };
  }

  // ========================================================================
  // Provider Management
  // ========================================================================

  public registerProvider(provider: LLMProvider, client: any): void {
    this.providerClients.set(provider, client);
    this.events.emit('provider:registered', { provider });
  }

  public unregisterProvider(provider: LLMProvider): void {
    this.providerClients.delete(provider);
    this.events.emit('provider:unregistered', { provider });
  }

  public getProvider(provider: LLMProvider): any {
    return this.providerClients.get(provider);
  }

  // ========================================================================
  // Budget and Rate Limit Management
  // ========================================================================

  public createBudget(budget: BudgetConfig): void {
    this.costOptimizer.createBudget(budget);
  }

  public createRateLimit(quota: RateLimitQuota): void {
    this.rateLimiter.setQuota(quota);
  }

  private async checkRateLimits(request: LLMRequest, userId?: string): Promise<void> {
    // Check global rate limit
    const globalCheck = await this.rateLimiter.checkRateLimit('global', 0);
    if (!globalCheck.allowed) {
      throw new RateLimitExceededError('global', 0, globalCheck.resetTime);
    }

    // Check user-specific rate limit
    if (userId) {
      const userCheck = await this.rateLimiter.checkRateLimit(`user:${userId}`, 0);
      if (!userCheck.allowed) {
        throw new RateLimitExceededError(userId, 0, userCheck.resetTime);
      }
    }
  }

  private async checkBudgets(request: LLMRequest, userId?: string): Promise<void> {
    // Estimate cost
    const estimatedCost = await this.costOptimizer.estimateCost(
      request,
      { input: 1, output: 2 } // Default pricing
    );

    // Check budgets
    for (const budget of this.costOptimizer.getAllBudgets()) {
      const spending = this.costOptimizer.getBudgetSpending(budget.id);
      if (spending + estimatedCost > budget.limit) {
        throw new BudgetExceededError(budget.id, budget.limit, spending);
      }
    }
  }

  private async trackCost(
    request: LLMRequest,
    response: LLMResponse,
    userId?: string
  ): Promise<void> {
    const model = response.model;
    const modelInfo = this.registry.getModel(model);
    if (!modelInfo) return;

    const pricing = modelInfo.metadata.pricing;
    this.costOptimizer.trackRequest(
      request,
      response,
      pricing,
      userId,
      response.id
    );
  }

  // ========================================================================
  // Prompt Management
  // ========================================================================

  public renderPrompt(templateId: string, variables: Record<string, unknown>): string {
    return this.promptEngine.render(templateId, variables);
  }

  public async optimizePrompt(templateId: string) {
    return this.promptEngine.optimize(templateId);
  }

  // ========================================================================
  // Analytics and Monitoring
  // ========================================================================

  public getAnalytics() {
    return {
      registry: {
        totalModels: this.registry.getAllModels().length,
        availableModels: this.registry.getAllModels().filter((m) => m.status === 'available').length,
      },
      router: this.router.getAnalytics(),
      cost: this.costOptimizer.getAnalytics(),
      rateLimit: this.rateLimiter.getAnalytics(),
      promptEngine: this.promptEngine.getAnalytics(),
      aggregator: this.aggregator.getAnalytics(),
    };
  }

  public getMetrics() {
    return {
      models: this.registry.getAllMetrics(),
      routing: this.router.getRequestHistory(),
      costs: this.costOptimizer.getTracking(),
      rateLimits: this.rateLimiter.getAllStatuses(),
    };
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  private selectModelsForAggregation(request: LLMRequest, count: number): string[] {
    const available = this.registry
      .getAllModels()
      .filter((m) => m.status === 'available')
      .sort((a, b) => b.availability - a.availability);

    return available.slice(0, count).map((m) => m.metadata.id);
  }

  private extractProvider(model: string): LLMProvider {
    if (model.startsWith('gpt')) return 'openai';
    if (model.startsWith('claude')) return 'anthropic';
    if (model.startsWith('gemini')) return 'google';
    if (model.startsWith('llama')) return 'meta';
    if (model.startsWith('mistral')) return 'mistral';
    return 'custom';
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupEventForwarding(): void {
    // Forward events from components
    this.registry.on('model:status-changed', (data) => {
      this.events.emit('model:status-changed', data);
    });

    this.router.on('routing:decision', (data) => {
      this.events.emit('routing:decision', data);
    });

    this.costOptimizer.on('budget:exceeded', (data) => {
      this.events.emit('budget:exceeded', data);
    });

    this.rateLimiter.on('rate-limit:exceeded', (data) => {
      this.events.emit('rate-limit:exceeded', data);
    });
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
  // Lifecycle
  // ========================================================================

  public dispose(): void {
    this.registry.dispose();
    this.router.clearCache();
    this.rateLimiter.stopCleanup();
    this.providerClients.clear();
    this.events.removeAllListeners();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createOrchestrationEngine(
  config?: Partial<OrchestrationEngineConfig>,
  llmConfig?: Partial<LLMOrchestrationConfig>
): LLMOrchestrationEngine {
  return new LLMOrchestrationEngine(config, llmConfig);
}
