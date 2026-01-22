/**
 * LLM Router - Intelligent routing system for selecting optimal models
 */

import { EventEmitter } from 'eventemitter3';
import { ModelRegistry } from '../models/registry.js';
import {
  LLMRequest,
  LLMProvider,
  RoutingStrategy,
  RoutingDecision,
  RoutingOptions,
  RoutingRule,
  ModelCapabilities,
  ModelUnavailableError,
  ModelInfo,
  LLMOrchestrationError,
} from '../types/index.js';

// ============================================================================
// Router Configuration
// ============================================================================

export interface RouterConfig {
  defaultStrategy: RoutingStrategy;
  fallbackEnabled: boolean;
  maxFallbackAttempts: number;
  timeout: number;
  enableABTesting: boolean;
  enableCaching: boolean;
  cacheTTL: number;
  customStrategies?: Map<string, CustomRoutingStrategy>;
}

export interface CustomRoutingStrategy {
  name: string;
  description: string;
  rankModels: (
    request: LLMRequest,
    models: ModelInfo[]
  ) => Promise<Array<{ model: ModelInfo; score: number }>>;
}

// ============================================================================
// Router Class
// ============================================================================

export class LLMRouter {
  private registry: ModelRegistry;
  private config: RouterConfig;
  private events: EventEmitter;
  private rules: RoutingRule[];
  private routingCache: Map<string, { decision: RoutingDecision; timestamp: number }>;
  private abTestGroups: Map<string, string>;
  private requestHistory: Array<{ request: LLMRequest; decision: RoutingDecision; timestamp: number }>;

  constructor(registry: ModelRegistry, config: Partial<RouterConfig> = {}) {
    this.registry = registry;
    this.config = {
      defaultStrategy: config.defaultStrategy || 'capability',
      fallbackEnabled: config.fallbackEnabled ?? true,
      maxFallbackAttempts: config.maxFallbackAttempts ?? 3,
      timeout: config.timeout ?? 30000,
      enableABTesting: config.enableABTesting ?? false,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
      customStrategies: config.customStrategies || new Map(),
    };
    this.events = new EventEmitter();
    this.rules = [];
    this.routingCache = new Map();
    this.abTestGroups = new Map();
    this.requestHistory = [];

    this.initializeDefaultRules();
  }

  // ========================================================================
  // Main Routing Method
  // ========================================================================

  public async route(
    request: LLMRequest,
    options?: RoutingOptions
  ): Promise<RoutingDecision> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Check cache if enabled
      if (this.config.enableCaching) {
        const cached = this.getCachedDecision(request);
        if (cached && !options?.capabilityRequirements) {
          this.events.emit('routing:cache-hit', { requestId, decision: cached });
          return cached;
        }
      }

      // Apply routing rules
      const ruleResult = this.applyRoutingRules(request);
      if (ruleResult) {
        this.events.emit('routing:rule-applied', { requestId, rule: ruleResult });
      }

      // Get available models
      let availableModels = this.getAvailableModels(request, options);

      if (availableModels.length === 0) {
        throw new ModelUnavailableError(
          'No models available matching requirements',
          'NO_MODELS_AVAILABLE'
        );
      }

      // Apply routing strategy
      const strategy = options?.strategy || this.config.defaultStrategy;
      let rankedModels = await this.applyStrategy(strategy, request, availableModels, options);

      // Apply A/B testing if enabled
      if (this.config.enableABTesting) {
        rankedModels = this.applyABTesting(requestId, rankedModels);
      }

      // Select best model
      const selected = rankedModels[0];
      const alternatives = rankedModels.slice(1, 4).map((r) => ({
        model: r.model.metadata.id,
        provider: r.model.metadata.provider,
        score: r.score,
      }));

      const decision: RoutingDecision = {
        model: selected.model.metadata.id,
        provider: selected.model.metadata.provider,
        confidence: selected.score,
        reasoning: this.generateReasoning(selected, request, options),
        alternatives,
        appliedRules: ruleResult ? [ruleResult.id] : [],
      };

      // Update model load
      this.registry.updateModelLoad(
        decision.model,
        Math.min(1, selected.model.currentLoad + 0.1)
      );

      // Cache decision
      if (this.config.enableCaching) {
        this.cacheDecision(request, decision);
      }

      // Record history
      this.recordRequest(request, decision);

      // Emit event
      this.events.emit('routing:decision', { requestId, decision, duration: Date.now() - startTime });

      return decision;
    } catch (error) {
      // Handle fallback if enabled
      if (this.config.fallbackEnabled && options?.fallbackEnabled !== false) {
        return this.handleFallback(request, options, error as Error);
      }
      throw error;
    }
  }

  // ========================================================================
  // Strategy Application
  // ========================================================================

  private async applyStrategy(
    strategy: RoutingStrategy,
    request: LLMRequest,
    models: ModelInfo[],
    options?: RoutingOptions
  ): Promise<Array<{ model: ModelInfo; score: number }>> {
    switch (strategy) {
      case 'capability':
        return this.rankByCapability(request, models, options?.capabilityRequirements);

      case 'cost':
        return this.rankByCost(request, models, options?.costLimit);

      case 'performance':
        return this.rankByPerformance(models);

      case 'latency':
        return this.rankByLatency(models);

      case 'availability':
        return this.rankByAvailability(models);

      case 'round-robin':
        return this.rankRoundRobin(models);

      case 'weighted':
        return this.rankWeighted(models);

      case 'custom':
        throw new LLMOrchestrationError(
          'Custom strategy must be specified in options',
          'CUSTOM_STRATEGY_REQUIRED'
        );

      default:
        return this.rankByCapability(request, models);
    }
  }

  private rankByCapability(
    request: LLMRequest,
    models: ModelInfo[],
    requiredCapabilities?: Partial<ModelCapabilities>
  ): Array<{ model: ModelInfo; score: number }> {
    const query = this.extractQueryFeatures(request);

    return models
      .map((model) => {
        let score = 0;
        const weights = {
          code: 0.25,
          reasoning: 0.20,
          tools: 0.15,
          context: 0.15,
          speed: 0.10,
          quality: 0.15,
        };

        // Code capability
        if (query.needsCode) {
          const codeScore = model.metadata.capabilities.codeGeneration.confidence || 0;
          score += codeScore * weights.code;
        }

        // Reasoning capability
        if (query.needsReasoning) {
          const reasoningScore = model.metadata.capabilities.reasoning.confidence || 0;
          score += reasoningScore * weights.reasoning;
        }

        // Tool/function calling
        if (query.needsTools) {
          const toolScore = model.metadata.capabilities.functionCalling.confidence || 0;
          score += toolScore * weights.tools;
        }

        // Context window
        const contextScore = Math.min(1, query.estimatedTokens / model.metadata.constraints.maxTokens);
        score += (1 - contextScore) * weights.context;

        // Speed (inverse of latency)
        const speedScore = Math.max(0, 1 - model.metadata.performance.avgLatency / 5000);
        score += speedScore * weights.speed;

        // Overall quality
        const qualityScore = model.metadata.performance.successRate;
        score += qualityScore * weights.quality;

        // Apply required capabilities filter
        if (requiredCapabilities) {
          for (const [key, req] of Object.entries(requiredCapabilities)) {
            const modelCap = model.metadata.capabilities[key as keyof ModelCapabilities];
            if (req.supported && !modelCap.supported) {
              score = 0;
              break;
            }
            if (req.confidence && (modelCap.confidence || 0) < req.confidence) {
              score *= 0.5;
            }
          }
        }

        return { model, score: score * model.availability };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private rankByCost(
    request: LLMRequest,
    models: ModelInfo[],
    costLimit?: number
  ): Array<{ model: ModelInfo; score: number }> {
    const query = this.extractQueryFeatures(request);
    const estimatedInputTokens = query.estimatedTokens;
    const estimatedOutputTokens = Math.min(2048, estimatedInputTokens * 0.5);

    return models
      .map((model) => {
        const pricing = model.metadata.pricing;
        const estimatedCost =
          (estimatedInputTokens / 1_000_000) * pricing.input +
          (estimatedOutputTokens / 1_000_000) * pricing.output;

        if (costLimit && estimatedCost > costLimit) {
          return { model, score: 0 };
        }

        // Lower cost = higher score
        const maxCost = 100; // $100 per 1M tokens as reference
        const costScore = Math.max(0, 1 - estimatedCost / maxCost);

        // Adjust for availability
        return { model, score: costScore * model.availability };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private rankByPerformance(
    models: ModelInfo[]
  ): Array<{ model: ModelInfo; score: number }> {
    return models
      .map((model) => {
        const perf = model.metadata.performance;
        const score =
          perf.successRate * 0.5 +
          (1 - perf.errorRate) * 0.3 +
          Math.max(0, 1 - perf.avgLatency / 5000) * 0.2;

        return { model, score: score * model.availability };
      })
      .sort((a, b) => b.score - a.score);
  }

  private rankByLatency(
    models: ModelInfo[]
  ): Array<{ model: ModelInfo; score: number }> {
    return models
      .map((model) => {
        const latency = model.metadata.performance.avgLatency || 5000;
        const score = Math.max(0, 1 - latency / 5000);

        return { model, score: score * model.availability };
      })
      .sort((a, b) => b.score - a.score);
  }

  private rankByAvailability(
    models: ModelInfo[]
  ): Array<{ model: ModelInfo; score: number }> {
    return models
      .map((model) => ({
        model,
        score: model.availability * (model.status === 'available' ? 1 : 0.5),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private rankRoundRobin(
    models: ModelInfo[]
  ): Array<{ model: ModelInfo; score: number }> {
    const timestamp = Date.now();
    return models
      .map((model, index) => ({
        model,
        score: (timestamp + index) % models.length,
      }))
      .sort((a, b) => b.score - a.score);
  }

  private rankWeighted(
    models: ModelInfo[]
  ): Array<{ model: ModelInfo; score: number }> {
    // Combine multiple factors with weights
    return models
      .map((model) => {
        const perf = model.metadata.performance;
        const pricing = model.metadata.pricing;

        const perfScore = perf.successRate * 0.4;
        const latencyScore = Math.max(0, 1 - perf.avgLatency / 5000) * 0.2;
        const costScore = Math.max(0, 1 - ((pricing.input + pricing.output) / 100)) * 0.2;
        const availabilityScore = model.availability * 0.2;

        const score = perfScore + latencyScore + costScore + availabilityScore;

        return { model, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  // ========================================================================
  // Query Analysis
  // ========================================================================

  private extractQueryFeatures(request: LLMRequest): QueryFeatures {
    let fullText = '';
    let needsCode = false;
    let needsReasoning = false;
    let needsTools = false;
    let estimatedTokens = 0;

    for (const msg of request.messages) {
      if (typeof msg.content === 'string') {
        fullText += msg.content + ' ';
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            fullText += part.text + ' ';
          }
        }
      }
    }

    // Analyze for code
    const codePatterns = [
      /```[\s\S]*?```/,
      /function\s+\w+/,
      /class\s+\w+/,
      /import\s+.*from/,
      /def\s+\w+/,
      /public\s+(static\s+)?void/,
    ];
    needsCode = codePatterns.some((pattern) => pattern.test(fullText));

    // Analyze for reasoning
    const reasoningKeywords = [
      'because', 'therefore', 'thus', 'consequently', 'analyze', 'evaluate',
      'compare', 'reasoning', 'logic', 'step by step', 'explain why',
    ];
    const reasoningText = fullText.toLowerCase();
    needsReasoning = reasoningKeywords.some((keyword) =>
      reasoningText.includes(keyword)
    );

    // Check for tools/functions
    needsTools = !!(request.tools && request.tools.length > 0);
    needsTools = needsTools || request.toolChoice !== undefined;

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    estimatedTokens = Math.ceil(fullText.length / 4);

    return {
      needsCode,
      needsReasoning,
      needsTools,
      estimatedTokens,
      hasImages: request.messages.some((msg) =>
        Array.isArray(msg.content)
          ? msg.content.some((part) => part.type === 'image')
          : false
      ),
      requiresStreaming: request.stream || false,
    };
  }

  // ========================================================================
  // Model Selection
  // ========================================================================

  private getAvailableModels(
    request: LLMRequest,
    options?: RoutingOptions
  ): ModelInfo[] {
    let models = this.registry.getAllModels();

    // Filter by status
    models = models.filter((m) => m.status === 'available');

    // Filter by multimodal requirement
    const query = this.extractQueryFeatures(request);
    if (query.hasImages) {
      models = models.filter((m) => m.metadata.capabilities.multimodal.supported);
    }

    // Filter by streaming requirement
    if (query.requiresStreaming) {
      models = models.filter((m) => m.metadata.capabilities.streaming.supported);
    }

    // Filter by latency limit
    if (options?.latencyLimit) {
      models = models.filter(
        (m) => m.metadata.performance.avgLatency <= options.latencyLimit!
      );
    }

    // Filter by context window
    models = models.filter((m) =>
      m.metadata.constraints.maxTokens >= query.estimatedTokens
    );

    // Apply fallback models if specified
    if (options?.fallbackModels && options.fallbackModels.length > 0) {
      const fallbackSet = new Set(options.fallbackModels);
      models = models.filter((m) => fallbackSet.has(m.metadata.id));
    }

    return models;
  }

  // ========================================================================
  // Routing Rules
  // ========================================================================

  public addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  public removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  public getRules(): RoutingRule[] {
    return [...this.rules];
  }

  private applyRoutingRules(request: LLMRequest): RoutingRule | null {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      if (this.evaluateCondition(rule.condition, request)) {
        return rule;
      }
    }
    return null;
  }

  private evaluateCondition(
    condition: any,
    request: LLMRequest
  ): boolean {
    switch (condition.type) {
      case 'user':
        return condition.operator === 'equals' &&
          request.user === condition.value;

      case 'query':
        const query = this.extractQueryFeatures(request);
        return this.evaluateQueryCondition(condition, query);

      case 'metadata':
        return this.evaluateMetadataCondition(condition, request.metadata);

      case 'composite':
        return this.evaluateCompositeCondition(condition, request);

      default:
        return false;
    }
  }

  private evaluateQueryCondition(condition: any, query: QueryFeatures): boolean {
    switch (condition.operator) {
      case 'equals':
        return query[condition.value as keyof QueryFeatures] === true;

      default:
        return false;
    }
  }

  private evaluateMetadataCondition(
    condition: any,
    metadata: Record<string, unknown> | undefined
  ): boolean {
    if (!metadata) return false;

    const value = metadata[condition.value as string];
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return Array.isArray(value) && value.includes(condition.value);
      default:
        return false;
    }
  }

  private evaluateCompositeCondition(
    condition: any,
    request: LLMRequest
  ): boolean {
    if (!condition.conditions) return false;

    const results = condition.conditions.map((c: any) =>
      this.evaluateCondition(c, request)
    );

    switch (condition.operator) {
      case 'and':
        return results.every((r: boolean) => r === true);
      case 'or':
        return results.some((r: boolean) => r === true);
      case 'not':
        return !results[0];
      default:
        return false;
    }
  }

  private initializeDefaultRules(): void {
    // Add default routing rules here
    this.addRule({
      id: 'default-code',
      name: 'Route code requests to capable models',
      priority: 100,
      condition: {
        type: 'query',
        operator: 'equals',
        value: 'needsCode',
      },
      action: {
        type: 'select-model',
        value: 'best-code-model',
      },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // ========================================================================
  // Fallback Handling
  // ========================================================================

  private async handleFallback(
    request: LLMRequest,
    options?: RoutingOptions,
    error?: Error
  ): Promise<RoutingDecision> {
    const fallbackModels = options?.fallbackModels ||
      this.registry.getAllModels()
        .filter((m) => m.status === 'available')
        .sort((a, b) => b.availability - a.availability)
        .slice(0, 5)
        .map((m) => m.metadata.id);

    for (const modelId of fallbackModels) {
      try {
        const model = this.registry.getModel(modelId);
        if (!model || model.status !== 'available') continue;

        const decision: RoutingDecision = {
          model: modelId,
          provider: model.metadata.provider,
          confidence: model.availability,
          reasoning: ['Fallback selection due to error'],
          alternatives: [],
          appliedRules: ['fallback'],
        };

        this.events.emit('routing:fallback', {
          originalError: error,
          fallbackDecision: decision,
        });

        return decision;
      } catch (e) {
        continue;
      }
    }

    throw new ModelUnavailableError(
      'All fallback models unavailable',
      'ALL_FALLBACKS_FAILED'
    );
  }

  // ========================================================================
  // A/B Testing
  // ========================================================================

  private assignABTestGroup(requestId: string): string {
    const groups = ['control', 'variant_a', 'variant_b'];
    const group = groups[Math.floor(Math.random() * groups.length)];
    this.abTestGroups.set(requestId, group);
    return group;
  }

  private applyABTesting(
    requestId: string,
    rankedModels: Array<{ model: ModelInfo; score: number }>
  ): Array<{ model: ModelInfo; score: number }> {
    const group = this.assignABTestGroup(requestId);

    switch (group) {
      case 'control':
        // Use default ranking
        return rankedModels;

      case 'variant_a':
        // Prioritize cost
        return rankedModels
          .map((r) => ({
            ...r,
            score: r.score * 0.5 +
              (1 - (r.model.metadata.pricing.input + r.model.metadata.pricing.output) / 100) * 0.5,
          }))
          .sort((a, b) => b.score - a.score);

      case 'variant_b':
        // Prioritize performance
        return rankedModels
          .map((r) => ({
            ...r,
            score: r.score * 0.5 + r.model.metadata.performance.successRate * 0.5,
          }))
          .sort((a, b) => b.score - a.score);

      default:
        return rankedModels;
    }
  }

  // ========================================================================
  // Caching
  // ========================================================================

  private cacheDecision(request: LLMRequest, decision: RoutingDecision): void {
    const key = this.generateCacheKey(request);
    this.routingCache.set(key, {
      decision,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    this.cleanCache();
  }

  private getCachedDecision(request: LLMRequest): RoutingDecision | null {
    const key = this.generateCacheKey(request);
    const cached = this.routingCache.get(key);

    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTTL) {
      this.routingCache.delete(key);
      return null;
    }

    return cached.decision;
  }

  private generateCacheKey(request: LLMRequest): string {
    const features = this.extractQueryFeatures(request);
    return JSON.stringify({
      needsCode: features.needsCode,
      needsReasoning: features.needsReasoning,
      needsTools: features.needsTools,
      hasImages: features.hasImages,
      stream: request.stream,
    });
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.routingCache.entries()) {
      if (now - value.timestamp > this.config.cacheTTL) {
        this.routingCache.delete(key);
      }
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateReasoning(
    selected: { model: ModelInfo; score: number },
    request: LLMRequest,
    options?: RoutingOptions
  ): string[] {
    const reasoning: string[] = [];

    const strategy = options?.strategy || this.config.defaultStrategy;
    reasoning.push(`Strategy: ${strategy}`);

    reasoning.push(
      `Model: ${selected.model.metadata.name} (${selected.model.metadata.provider})`
    );

    reasoning.push(
      `Availability: ${(selected.model.availability * 100).toFixed(1)}%`
    );

    if (selected.model.metadata.performance.avgLatency > 0) {
      reasoning.push(
        `Avg Latency: ${selected.model.metadata.performance.avgLatency.toFixed(0)}ms`
      );
    }

    reasoning.push(
      `Cost: $${selected.model.metadata.pricing.input}/$${selected.model.metadata.pricing.output} per 1M tokens`
    );

    reasoning.push(`Confidence Score: ${(selected.score * 100).toFixed(1)}%`);

    return reasoning;
  }

  private recordRequest(
    request: LLMRequest,
    decision: RoutingDecision
  ): void {
    this.requestHistory.push({
      request,
      decision,
      timestamp: Date.now(),
    });

    // Keep only last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory.shift();
    }
  }

  public getRequestHistory(): typeof this.requestHistory {
    return [...this.requestHistory];
  }

  public clearCache(): void {
    this.routingCache.clear();
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

  public getAnalytics(): RoutingAnalytics {
    const history = this.requestHistory;
    const modelUsage = new Map<string, number>();
    const providerUsage = new Map<LLMProvider, number>();
    const strategyUsage = new Map<string, number>();

    for (const record of history) {
      const modelId = record.decision.model;
      modelUsage.set(modelId, (modelUsage.get(modelId) || 0) + 1);

      const provider = record.decision.provider;
      providerUsage.set(provider, (providerUsage.get(provider) || 0) + 1);

      const strategy = this.extractQueryFeatures(record.request).needsCode
        ? 'capability-code'
        : 'capability-general';
      strategyUsage.set(strategy, (strategyUsage.get(strategy) || 0) + 1);
    }

    return {
      totalRequests: history.length,
      modelUsage: Object.fromEntries(modelUsage),
      providerUsage: Object.fromEntries(providerUsage) as Record<LLMProvider, number>,
      strategyUsage: Object.fromEntries(strategyUsage),
      cacheSize: this.routingCache.size,
      abTestGroups: this.abTestGroups.size,
    };
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface QueryFeatures {
  needsCode: boolean;
  needsReasoning: boolean;
  needsTools: boolean;
  estimatedTokens: number;
  hasImages: boolean;
  requiresStreaming: boolean;
}

export interface RoutingAnalytics {
  totalRequests: number;
  modelUsage: Record<string, number>;
  providerUsage: Record<LLMProvider, number>;
  strategyUsage: Record<string, number>;
  cacheSize: number;
  abTestGroups: number;
}
