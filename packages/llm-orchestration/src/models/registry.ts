/**
 * Model Registry - Central registry for LLM model metadata, capabilities, and performance tracking
 */

import { EventEmitter } from 'eventemitter3';
import type {
  ModelInfo,
  ModelMetadata,
  ModelStatus,
  ModelCapabilities,
  ModelPerformanceMetrics,
  ModelConstraints,
  ModelPricing,
  LLMProvider,
  ModelSize,
  ModelTier,
  ModelCapability,
} from '../types/index.js';
import { LLMOrchestrationError } from '../types/index.js';

// ============================================================================
// Default Model Data
// ============================================================================

const DEFAULT_MODEL_CAPABILITIES: Record<string, Partial<ModelCapabilities>> = {
  'gpt-4': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.95 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.95 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.98 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.97 },
    translation: { name: 'translation', supported: true, confidence: 0.92 },
    summarization: { name: 'summarization', supported: true, confidence: 0.96 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.97 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.94 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.91 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.96 },
    multimodal: { name: 'multimodal', supported: false, confidence: 0 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.95 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.96 },
  },
  'gpt-4-turbo': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.97 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.97 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.98 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.97 },
    translation: { name: 'translation', supported: true, confidence: 0.93 },
    summarization: { name: 'summarization', supported: true, confidence: 0.97 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.98 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.95 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.92 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.98 },
    multimodal: { name: 'multimodal', supported: true, confidence: 0.94 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.97 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.98 },
  },
  'gpt-3.5-turbo': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.85 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.83 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.92 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.90 },
    translation: { name: 'translation', supported: true, confidence: 0.88 },
    summarization: { name: 'summarization', supported: true, confidence: 0.90 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.91 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.78 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.75 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.88 },
    multimodal: { name: 'multimodal', supported: false, confidence: 0 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.85 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.88 },
  },
  'claude-3-opus': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.96 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.95 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.99 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.98 },
    translation: { name: 'translation', supported: true, confidence: 0.95 },
    summarization: { name: 'summarization', supported: true, confidence: 0.98 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.98 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.97 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.93 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.94 },
    multimodal: { name: 'multimodal', supported: true, confidence: 0.96 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.93 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.97 },
  },
  'claude-3-sonnet': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.93 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.92 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.97 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.96 },
    translation: { name: 'translation', supported: true, confidence: 0.93 },
    summarization: { name: 'summarization', supported: true, confidence: 0.96 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.96 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.94 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.90 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.93 },
    multimodal: { name: 'multimodal', supported: true, confidence: 0.94 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.91 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.94 },
  },
  'claude-3-haiku': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.85 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.84 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.93 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.92 },
    translation: { name: 'translation', supported: true, confidence: 0.88 },
    summarization: { name: 'summarization', supported: true, confidence: 0.92 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.92 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.86 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.82 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.86 },
    multimodal: { name: 'multimodal', supported: true, confidence: 0.88 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.84 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.87 },
  },
  'gemini-pro': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.90 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.89 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.95 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.94 },
    translation: { name: 'translation', supported: true, confidence: 0.96 },
    summarization: { name: 'summarization', supported: true, confidence: 0.94 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.94 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.88 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.91 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.89 },
    multimodal: { name: 'multimodal', supported: true, confidence: 0.95 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.88 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 0.9 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.89 },
  },
  'gemini-ultra': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.95 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.94 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.98 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.97 },
    translation: { name: 'translation', supported: true, confidence: 0.97 },
    summarization: { name: 'summarization', supported: true, confidence: 0.97 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.97 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.95 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.94 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.94 },
    multimodal: { name: 'multimodal', supported: true, confidence: 0.98 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.93 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 0.9 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.95 },
  },
  'llama-3-70b': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.88 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.87 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.93 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.92 },
    translation: { name: 'translation', supported: true, confidence: 0.89 },
    summarization: { name: 'summarization', supported: true, confidence: 0.91 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.91 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.85 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.82 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.84 },
    multimodal: { name: 'multimodal', supported: false, confidence: 0 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.82 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.84 },
  },
  'mistral-large': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.92 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.91 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.95 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.94 },
    translation: { name: 'translation', supported: true, confidence: 0.93 },
    summarization: { name: 'summarization', supported: true, confidence: 0.94 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.94 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.89 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.86 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.90 },
    multimodal: { name: 'multimodal', supported: false, confidence: 0 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.88 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.90 },
  },
  'mistral-medium': {
    codeGeneration: { name: 'codeGeneration', supported: true, confidence: 0.87 },
    codeAnalysis: { name: 'codeAnalysis', supported: true, confidence: 0.86 },
    textGeneration: { name: 'textGeneration', supported: true, confidence: 0.92 },
    textAnalysis: { name: 'textAnalysis', supported: true, confidence: 0.91 },
    translation: { name: 'translation', supported: true, confidence: 0.90 },
    summarization: { name: 'summarization', supported: true, confidence: 0.91 },
    questionAnswering: { name: 'questionAnswering', supported: true, confidence: 0.91 },
    reasoning: { name: 'reasoning', supported: true, confidence: 0.84 },
    mathematics: { name: 'mathematics', supported: true, confidence: 0.81 },
    functionCalling: { name: 'functionCalling', supported: true, confidence: 0.85 },
    multimodal: { name: 'multimodal', supported: false, confidence: 0 },
    streaming: { name: 'streaming', supported: true, confidence: 1 },
    jsonMode: { name: 'jsonMode', supported: true, confidence: 0.84 },
    systemPrompt: { name: 'systemPrompt', supported: true, confidence: 1 },
    contextWindow: { name: 'contextWindow', supported: true, confidence: 1 },
    toolUse: { name: 'toolUse', supported: true, confidence: 0.85 },
  },
};

const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4': {
    input: 30,
    output: 60,
    currency: 'USD',
  },
  'gpt-4-turbo': {
    input: 10,
    output: 30,
    currency: 'USD',
  },
  'gpt-3.5-turbo': {
    input: 0.5,
    output: 1.5,
    currency: 'USD',
  },
  'claude-3-opus': {
    input: 15,
    output: 75,
    currency: 'USD',
  },
  'claude-3-sonnet': {
    input: 3,
    output: 15,
    currency: 'USD',
  },
  'claude-3-haiku': {
    input: 0.25,
    output: 1.25,
    currency: 'USD',
  },
  'gemini-pro': {
    input: 0.5,
    output: 1.5,
    currency: 'USD',
  },
  'gemini-ultra': {
    input: 1,
    output: 3,
    currency: 'USD',
  },
  'llama-3-70b': {
    input: 0.7,
    output: 0.7,
    currency: 'USD',
  },
  'mistral-large': {
    input: 4,
    output: 16,
    currency: 'USD',
  },
  'mistral-medium': {
    input: 2.7,
    output: 8.1,
    currency: 'USD',
  },
};

const DEFAULT_MODEL_CONSTRAINTS: Record<string, ModelConstraints> = {
  'gpt-4': {
    maxTokens: 8192,
    maxOutputTokens: 4096,
    maxContextLength: 8192,
    maxRequestsPerMinute: 10000,
    maxTokensPerMinute: 150000,
  },
  'gpt-4-turbo': {
    maxTokens: 128000,
    maxOutputTokens: 4096,
    maxContextLength: 128000,
    maxRequestsPerMinute: 10000,
    maxTokensPerMinute: 2000000,
  },
  'gpt-3.5-turbo': {
    maxTokens: 16385,
    maxOutputTokens: 4096,
    maxContextLength: 16385,
    maxRequestsPerMinute: 10000,
    maxTokensPerMinute: 160000,
  },
  'claude-3-opus': {
    maxTokens: 200000,
    maxOutputTokens: 4096,
    maxContextLength: 200000,
    maxRequestsPerMinute: 5000,
    maxTokensPerMinute: 400000,
  },
  'claude-3-sonnet': {
    maxTokens: 200000,
    maxOutputTokens: 4096,
    maxContextLength: 200000,
    maxRequestsPerMinute: 5000,
    maxTokensPerMinute: 400000,
  },
  'claude-3-haiku': {
    maxTokens: 200000,
    maxOutputTokens: 4096,
    maxContextLength: 200000,
    maxRequestsPerMinute: 5000,
    maxTokensPerMinute: 400000,
  },
  'gemini-pro': {
    maxTokens: 91728,
    maxOutputTokens: 8192,
    maxContextLength: 91728,
    maxRequestsPerMinute: 60,
  },
  'gemini-ultra': {
    maxTokens: 32000,
    maxOutputTokens: 2048,
    maxContextLength: 32000,
    maxRequestsPerMinute: 60,
  },
  'llama-3-70b': {
    maxTokens: 8192,
    maxOutputTokens: 2048,
    maxContextLength: 8192,
    maxRequestsPerMinute: 60,
  },
  'mistral-large': {
    maxTokens: 32000,
    maxOutputTokens: 4096,
    maxContextLength: 32000,
    maxRequestsPerMinute: 80,
  },
  'mistral-medium': {
    maxTokens: 32000,
    maxOutputTokens: 4096,
    maxContextLength: 32000,
    maxRequestsPerMinute: 80,
  },
};

// ============================================================================
// Model Registry Class
// ============================================================================

export interface ModelRegistryOptions {
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
  enableMetricsCollection?: boolean;
  metricsRetentionDays?: number;
  autoUpdateModels?: boolean;
}

export class ModelRegistry {
  private models: Map<string, ModelInfo>;
  private providers: Map<LLMProvider, ProviderState>;
  private healthCheckTimers: Map<string, NodeJS.Timeout>;
  private metrics: Map<string, ModelMetrics>;
  private events: EventEmitter;
  private options: Required<ModelRegistryOptions>;

  constructor(options: ModelRegistryOptions = {}) {
    this.models = new Map();
    this.providers = new Map();
    this.healthCheckTimers = new Map();
    this.metrics = new Map();
    this.events = new EventEmitter();
    this.options = {
      enableHealthChecks: options.enableHealthChecks ?? true,
      healthCheckInterval: options.healthCheckInterval ?? 60000,
      enableMetricsCollection: options.enableMetricsCollection ?? true,
      metricsRetentionDays: options.metricsRetentionDays ?? 30,
      autoUpdateModels: options.autoUpdateModels ?? false,
    };

    this.initializeDefaultModels();
    if (this.options.enableHealthChecks) {
      this.startHealthChecks();
    }
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private initializeDefaultModels(): void {
    const defaultModels: Array<{
      id: string;
      provider: LLMProvider;
      size: ModelSize;
      tier: ModelTier;
    }> = [
      { id: 'gpt-4', provider: 'openai', size: 'xlarge', tier: 'premium' },
      { id: 'gpt-4-turbo', provider: 'openai', size: 'large', tier: 'premium' },
      { id: 'gpt-3.5-turbo', provider: 'openai', size: 'medium', tier: 'standard' },
      { id: 'claude-3-opus', provider: 'anthropic', size: 'xlarge', tier: 'premium' },
      { id: 'claude-3-sonnet', provider: 'anthropic', size: 'large', tier: 'standard' },
      { id: 'claude-3-haiku', provider: 'anthropic', size: 'small', tier: 'basic' },
      { id: 'gemini-pro', provider: 'google', size: 'large', tier: 'standard' },
      { id: 'gemini-ultra', provider: 'google', size: 'xlarge', tier: 'premium' },
      { id: 'llama-3-70b', provider: 'meta', size: 'xlarge', tier: 'standard' },
      { id: 'mistral-large', provider: 'mistral', size: 'large', tier: 'premium' },
      { id: 'mistral-medium', provider: 'mistral', size: 'medium', tier: 'standard' },
    ];

    for (const modelDef of defaultModels) {
      const metadata = this.createModelMetadata(modelDef);
      const modelInfo: ModelInfo = {
        metadata,
        status: 'available',
        availability: 1.0,
        currentLoad: 0.0,
        lastHealthCheck: new Date(),
      };

      this.models.set(modelDef.id, modelInfo);
      this.metrics.set(modelDef.id, this.createInitialMetrics(modelDef.id));

      if (!this.providers.has(modelDef.provider)) {
        this.providers.set(modelDef.provider, {
          status: 'available',
          modelCount: 0,
          lastHealthCheck: new Date(),
        });
      }

      const providerState = this.providers.get(modelDef.provider)!;
      providerState.modelCount++;
    }
  }

  private createModelMetadata(def: {
    id: string;
    provider: LLMProvider;
    size: ModelSize;
    tier: ModelTier;
  }): ModelMetadata {
    const capabilities = this.createCapabilities(def.id);
    const pricing = DEFAULT_MODEL_PRICING[def.id] || {
      input: 1,
      output: 2,
      currency: 'USD',
    };
    const constraints = DEFAULT_MODEL_CONSTRAINTS[def.id] || {
      maxTokens: 4096,
      maxContextLength: 4096,
    };
    const performance = this.createInitialPerformance();

    return {
      id: def.id,
      name: def.id,
      provider: def.provider,
      version: '1.0.0',
      size: def.size,
      tier: def.tier,
      capabilities,
      pricing,
      performance,
      constraints,
      versions: [
        {
          version: '1.0.0',
          released: new Date(),
        },
      ],
      tags: this.generateTags(def),
      fineTuned: false,
    };
  }

  private createCapabilities(modelId: string): ModelCapabilities {
    const defaults = DEFAULT_MODEL_CAPABILITIES[modelId] || {};

    const createCapability = (
      name: string,
      supported = true,
      confidence = 0.5
    ): ModelCapability => ({
      name,
      supported,
      confidence,
      notes: '',
    });

    return {
      codeGeneration: defaults.codeGeneration || createCapability('codeGeneration'),
      codeAnalysis: defaults.codeAnalysis || createCapability('codeAnalysis'),
      textGeneration: defaults.textGeneration || createCapability('textGeneration'),
      textAnalysis: defaults.textAnalysis || createCapability('textAnalysis'),
      translation: defaults.translation || createCapability('translation'),
      summarization: defaults.summarization || createCapability('summarization'),
      questionAnswering: defaults.questionAnswering || createCapability('questionAnswering'),
      reasoning: defaults.reasoning || createCapability('reasoning'),
      mathematics: defaults.mathematics || createCapability('mathematics'),
      functionCalling: defaults.functionCalling || createCapability('functionCalling'),
      multimodal: defaults.multimodal || createCapability('multimodal', false, 0),
      streaming: createCapability('streaming', true, 1),
      jsonMode: defaults.jsonMode || createCapability('jsonMode'),
      systemPrompt: createCapability('systemPrompt', true, 1),
      contextWindow: createCapability('contextWindow', true, 1),
      toolUse: defaults.toolUse || createCapability('toolUse'),
    };
  }

  private createInitialPerformance(): ModelPerformanceMetrics {
    return {
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      successRate: 1,
      errorRate: 0,
      timeoutRate: 0,
      lastUpdated: new Date(),
    };
  }

  private createInitialMetrics(modelId: string): ModelMetrics {
    return {
      requests: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
      avgTokens: 0,
      totalCost: 0,
      lastUsed: new Date(),
    };
  }

  private generateTags(def: { id: string; provider: LLMProvider; size: ModelSize; tier: ModelTier }): string[] {
    const tags = [def.provider, def.size, def.tier];

    if (def.id.includes('turbo')) tags.push('fast' as never);
    if (def.id.includes('opus') || def.id.includes('ultra')) tags.push('flagship' as never);
    if (def.id.includes('haiku') || def.id.includes('small')) tags.push('economical' as never);

    return tags;
  }

  // ========================================================================
  // Model Management
  // ========================================================================

  public registerModel(metadata: ModelMetadata): void {
    const modelInfo: ModelInfo = {
      metadata,
      status: 'available',
      availability: 1.0,
      currentLoad: 0.0,
      lastHealthCheck: new Date(),
    };

    this.models.set(metadata.id, modelInfo);
    this.metrics.set(metadata.id, this.createInitialMetrics(metadata.id));

    if (!this.providers.has(metadata.provider)) {
      this.providers.set(metadata.provider, {
        status: 'available',
        modelCount: 0,
        lastHealthCheck: new Date(),
      });
    }

    const providerState = this.providers.get(metadata.provider)!;
    providerState.modelCount++;

    this.events.emit('model:registered', { model: metadata.id });
  }

  public unregisterModel(modelId: string): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    const providerState = this.providers.get(model.metadata.provider);
    if (providerState) {
      providerState.modelCount--;
    }

    this.models.delete(modelId);
    this.metrics.delete(modelId);
    this.healthCheckTimers.delete(modelId);

    this.events.emit('model:unregistered', { model: modelId });
    return true;
  }

  public getModel(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  public getAllModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  public getModelsByProvider(provider: LLMProvider): ModelInfo[] {
    return Array.from(this.models.values()).filter(
      (m) => m.metadata.provider === provider
    );
  }

  public getModelsByCapability(
    capability: keyof ModelCapabilities,
    minConfidence = 0.5
  ): ModelInfo[] {
    return Array.from(this.models.values()).filter((model) => {
      const cap = model.metadata.capabilities[capability];
      return cap.supported && (cap.confidence ?? 0) >= minConfidence;
    });
  }

  public getModelsByTier(tier: ModelTier): ModelInfo[] {
    return Array.from(this.models.values()).filter(
      (m) => m.metadata.tier === tier
    );
  }

  public findModelsByTags(tags: string[]): ModelInfo[] {
    return Array.from(this.models.values()).filter((model) =>
      tags.some((tag) => model.metadata.tags.includes(tag))
    );
  }

  // ========================================================================
  // Model Search & Filtering
  // ========================================================================

  public searchModels(query: {
    provider?: LLMProvider;
    tier?: ModelTier;
    size?: ModelSize;
    capabilities?: Partial<ModelCapabilities>;
    minAvailability?: number;
    maxCostPer1M?: number;
    supportsMultimodal?: boolean;
    maxLatency?: number;
  }): ModelInfo[] {
    let results = Array.from(this.models.values());

    if (query.provider) {
      results = results.filter((m) => m.metadata.provider === query.provider);
    }

    if (query.tier) {
      results = results.filter((m) => m.metadata.tier === query.tier);
    }

    if (query.size) {
      results = results.filter((m) => m.metadata.size === query.size);
    }

    if (query.minAvailability !== undefined) {
      results = results.filter((m) => m.availability >= query.minAvailability!);
    }

    if (query.maxCostPer1M !== undefined) {
      results = results.filter(
        (m) =>
          m.metadata.pricing.input <= query.maxCostPer1M! &&
          m.metadata.pricing.output <= query.maxCostPer1M!
      );
    }

    if (query.supportsMultimodal) {
      results = results.filter((m) => m.metadata.capabilities.multimodal.supported);
    }

    if (query.maxLatency !== undefined) {
      results = results.filter(
        (m) => m.metadata.performance.avgLatency <= query.maxLatency!
      );
    }

    if (query.capabilities) {
      results = results.filter((model) => {
        for (const [key, requiredCap] of Object.entries(query.capabilities!)) {
          const modelCap = model.metadata.capabilities[key as keyof ModelCapabilities];
          if (requiredCap.supported && !modelCap.supported) return false;
          if (
            requiredCap.confidence &&
            (modelCap.confidence ?? 0) < requiredCap.confidence
          ) {
            return false;
          }
        }
        return true;
      });
    }

    return results.sort((a, b) => b.availability - a.availability);
  }

  public findBestModelForQuery(requirements: {
    capabilities?: Array<keyof ModelCapabilities>;
    maxCost?: number;
    maxLatency?: number;
    preferredProvider?: LLMProvider;
    priority?: 'cost' | 'performance' | 'availability';
  }): ModelInfo | undefined {
    const results = this.searchModels({
      provider: requirements.preferredProvider,
      maxCostPer1M: requirements.maxCost,
      maxLatency: requirements.maxLatency,
    });

    if (results.length === 0) return undefined;

    const priority = requirements.priority || 'performance';

    return results.sort((a, b) => {
      switch (priority) {
        case 'cost':
          const costA = a.metadata.pricing.input + a.metadata.pricing.output;
          const costB = b.metadata.pricing.input + b.metadata.pricing.output;
          return costA - costB;

        case 'performance':
          const perfA = this.calculatePerformanceScore(a);
          const perfB = this.calculatePerformanceScore(b);
          return perfB - perfA;

        case 'availability':
          return b.availability - a.availability;

        default:
          return 0;
      }
    })[0];
  }

  private calculatePerformanceScore(model: ModelInfo): number {
    const {
      metadata: { capabilities, performance, pricing },
      availability,
    } = model;

    const capabilityScore =
      Object.values(capabilities)
        .filter((c) => c.supported)
        .reduce((sum, c) => sum + (c.confidence ?? 0), 0) /
      Object.values(capabilities).length;

    const latencyScore = Math.max(0, 1 - performance.avgLatency / 10000);
    const successScore = performance.successRate;
    const availabilityScore = availability;

    return (
      (capabilityScore * 0.3 +
        latencyScore * 0.2 +
        successScore * 0.3 +
        availabilityScore * 0.2) *
      100
    );
  }

  // ========================================================================
  // Health Monitoring
  // ========================================================================

  private startHealthChecks(): void {
    setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [modelId, model] of this.models) {
      try {
        await this.checkModelHealth(modelId);
      } catch (error) {
        console.error(`Health check failed for ${modelId}:`, error);
      }
    }
  }

  public async checkModelHealth(modelId: string): Promise<ModelStatus> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new LLMOrchestrationError(
        `Model ${modelId} not found`,
        'MODEL_NOT_FOUND'
      );
    }

    // Simulate health check - in production, this would make actual API calls
    const isHealthy = Math.random() > 0.05; // 95% uptime simulation

    const newStatus: ModelStatus = isHealthy ? 'available' : 'degraded';
    const oldStatus = model.status;

    model.status = newStatus;
    model.availability = isHealthy ? Math.min(1, model.availability + 0.1) : Math.max(0, model.availability - 0.2);
    model.lastHealthCheck = new Date();

    if (oldStatus !== newStatus) {
      this.events.emit('model:status-changed', {
        model: modelId,
        oldStatus,
        newStatus,
      });
    }

    return newStatus;
  }

  public updateModelStatus(
    modelId: string,
    status: ModelStatus,
    availability?: number
  ): void {
    const model = this.models.get(modelId);
    if (!model) return;

    model.status = status;
    if (availability !== undefined) {
      model.availability = Math.max(0, Math.min(1, availability));
    }
    model.lastHealthCheck = new Date();

    this.events.emit('model:status-updated', { model: modelId, status });
  }

  public updateModelLoad(modelId: string, load: number): void {
    const model = this.models.get(modelId);
    if (!model) return;

    model.currentLoad = Math.max(0, Math.min(1, load));

    if (model.currentLoad > 0.9) {
      this.events.emit('model:high-load', { model: modelId, load });
    }
  }

  // ========================================================================
  // Performance Tracking
  // ========================================================================

  public recordRequest(
    modelId: string,
    latency: number,
    tokens: number,
    success: boolean,
    cost: number
  ): void {
    const metrics = this.metrics.get(modelId);
    if (!metrics) return;

    const model = this.models.get(modelId);
    if (!model) return;

    metrics.requests++;
    metrics.lastUsed = new Date();

    if (success) {
      metrics.successes++;
      const alpha = 0.2;
      metrics.avgLatency = metrics.avgLatency * (1 - alpha) + latency * alpha;
      metrics.avgTokens = metrics.avgTokens * (1 - alpha) + tokens * alpha;
    } else {
      metrics.failures++;
    }

    metrics.totalCost += cost;

    // Update performance metadata
    const perf = model.metadata.performance;
    perf.avgLatency = metrics.avgLatency;
    perf.throughput = metrics.requests / ((Date.now() - perf.lastUpdated.getTime()) / 1000);
    perf.successRate = metrics.successes / metrics.requests;
    perf.errorRate = metrics.failures / metrics.requests;
    perf.lastUpdated = new Date();

    this.events.emit('model:metrics-updated', { model: modelId, metrics });
  }

  public getModelMetrics(modelId: string): ModelMetrics | undefined {
    return this.metrics.get(modelId);
  }

  public getAllMetrics(): Map<string, ModelMetrics> {
    return new Map(this.metrics);
  }

  // ========================================================================
  // Provider Management
  // ========================================================================

  public getProviderStatus(provider: LLMProvider): ProviderState | undefined {
    return this.providers.get(provider);
  }

  public getAllProviders(): Map<LLMProvider, ProviderState> {
    return new Map(this.providers);
  }

  public updateProviderStatus(
    provider: LLMProvider,
    status: ModelStatus
  ): void {
    const providerState = this.providers.get(provider);
    if (!providerState) return;

    providerState.status = status;
    providerState.lastHealthCheck = new Date();

    // Update all models for this provider
    for (const [modelId, model] of this.models) {
      if (model.metadata.provider === provider) {
        model.status = status;
      }
    }

    this.events.emit('provider:status-updated', { provider, status });
  }

  // ========================================================================
  // Comparison & Analysis
  // ========================================================================

  public compareModels(modelIds: string[]): ModelComparison {
    const models = modelIds
      .map((id) => this.models.get(id))
      .filter((m) => m !== undefined) as ModelInfo[];

    if (models.length === 0) {
      throw new LLMOrchestrationError(
        'No valid models provided for comparison',
        'INVALID_MODELS'
      );
    }

    return {
      models: models.map((m) => ({
        id: m.metadata.id,
        name: m.metadata.name,
        provider: m.metadata.provider,
        capabilities: m.metadata.capabilities,
        performance: m.metadata.performance,
        pricing: m.metadata.pricing,
        availability: m.availability,
      })),
      recommendations: this.generateRecommendations(models),
      costComparison: this.generateCostComparison(models),
      performanceComparison: this.generatePerformanceComparison(models),
    };
  }

  private generateRecommendations(models: ModelInfo[]): string[] {
    const recommendations: string[] = [];

    const cheapest = [...models].sort(
      (a, b) =>
        a.metadata.pricing.input +
        a.metadata.pricing.output -
        (b.metadata.pricing.input + b.metadata.pricing.output)
    )[0];

    const fastest = [...models].sort(
      (a, b) =>
        a.metadata.performance.avgLatency -
        b.metadata.performance.avgLatency
    )[0];

    const mostCapable = [...models].sort((a, b) => {
      const scoreA = this.calculatePerformanceScore(a);
      const scoreB = this.calculatePerformanceScore(b);
      return scoreB - scoreA;
    })[0];

    if (cheapest && cheapest.metadata.id !== fastest?.metadata.id) {
      recommendations.push(
        `Use ${cheapest.metadata.id} for cost-sensitive applications`
      );
    }

    if (fastest && fastest.metadata.id !== mostCapable?.metadata.id) {
      recommendations.push(
        `Use ${fastest.metadata.id} for latency-sensitive applications`
      );
    }

    if (mostCapable) {
      recommendations.push(
        `Use ${mostCapable.metadata.id} for complex reasoning tasks`
      );
    }

    return recommendations;
  }

  private generateCostComparison(models: ModelInfo[]): CostComparison {
    return {
      cheapest: {
        model: models.sort(
          (a, b) =>
            a.metadata.pricing.input +
            a.metadata.pricing.output -
            (b.metadata.pricing.input + b.metadata.pricing.output)
        )[0].metadata.id,
        inputCost: Math.min(...models.map((m) => m.metadata.pricing.input)),
        outputCost: Math.min(...models.map((m) => m.metadata.pricing.output)),
      },
      mostExpensive: {
        model: models.sort(
          (a, b) =>
            (b.metadata.pricing.input + b.metadata.pricing.output) -
            (a.metadata.pricing.input + a.metadata.pricing.output)
        )[0].metadata.id,
        inputCost: Math.max(...models.map((m) => m.metadata.pricing.input)),
        outputCost: Math.max(...models.map((m) => m.metadata.pricing.output)),
      },
      average: {
        inputCost:
          models.reduce((sum, m) => sum + m.metadata.pricing.input, 0) /
          models.length,
        outputCost:
          models.reduce((sum, m) => sum + m.metadata.pricing.output, 0) /
          models.length,
      },
    };
  }

  private generatePerformanceComparison(models: ModelInfo[]): PerformanceComparison {
    return {
      fastest: {
        model: models.sort(
          (a, b) =>
            a.metadata.performance.avgLatency -
            b.metadata.performance.avgLatency
        )[0].metadata.id,
        latency: Math.min(...models.map((m) => m.metadata.performance.avgLatency)),
      },
      slowest: {
        model: models.sort(
          (a, b) =>
            b.metadata.performance.avgLatency -
            a.metadata.performance.avgLatency
        )[0].metadata.id,
        latency: Math.max(...models.map((m) => m.metadata.performance.avgLatency)),
      },
      mostReliable: {
        model: models.sort(
          (a, b) =>
            b.metadata.performance.successRate -
            a.metadata.performance.successRate
        )[0].metadata.id,
        successRate: Math.max(...models.map((m) => m.metadata.performance.successRate)),
      },
    };
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
  // Cleanup
  // ========================================================================

  public dispose(): void {
    for (const timer of this.healthCheckTimers.values()) {
      clearTimeout(timer);
    }
    this.healthCheckTimers.clear();
    this.models.clear();
    this.metrics.clear();
    this.providers.clear();
    this.events.removeAllListeners();
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface ModelComparison {
  models: Array<{
    id: string;
    name: string;
    provider: LLMProvider;
    capabilities: ModelCapabilities;
    performance: ModelPerformanceMetrics;
    pricing: ModelPricing;
    availability: number;
  }>;
  recommendations: string[];
  costComparison: CostComparison;
  performanceComparison: PerformanceComparison;
}

interface CostComparison {
  cheapest: { model: string; inputCost: number; outputCost: number };
  mostExpensive: { model: string; inputCost: number; outputCost: number };
  average: { inputCost: number; outputCost: number };
}

interface PerformanceComparison {
  fastest: { model: string; latency: number };
  slowest: { model: string; latency: number };
  mostReliable: { model: string; successRate: number };
}

// Re-export types from the main types module for convenience
export type { ModelInfo, ModelMetadata, ModelCapabilities, ModelPerformanceMetrics, ModelConstraints, ModelPricing } from '../types/index.js';

// Internal types
export interface ProviderState {
  status: ModelStatus;
  modelCount: number;
  lastHealthCheck: Date;
}

export interface ModelMetrics {
  requests: number;
  successes: number;
  failures: number;
  avgLatency: number;
  avgTokens: number;
  totalCost: number;
  lastUsed: Date;
}
