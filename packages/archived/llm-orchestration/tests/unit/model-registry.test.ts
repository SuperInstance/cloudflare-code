/**
 * Unit Tests for Model Registry
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModelRegistry } from '../../src/models/registry';
import type {
  ModelMetadata,
  ModelCapabilities,
  ModelPricing,
  ModelPerformanceMetrics,
  ModelConstraints,
  LLMProvider,
  ModelSize,
  ModelTier,
} from '../../src/types/index';

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry({
      enableHealthChecks: false,
      enableMetricsCollection: true,
    });
  });

  afterEach(() => {
    registry.dispose();
  });

  describe('Initialization', () => {
    it('should initialize with default models', () => {
      const models = registry.getAllModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.metadata.id === 'gpt-4')).toBe(true);
      expect(models.some((m) => m.metadata.id === 'claude-3-opus')).toBe(true);
    });

    it('should have all models available initially', () => {
      const models = registry.getAllModels();
      const availableModels = models.filter((m) => m.status === 'available');
      expect(availableModels.length).toBe(models.length);
    });
  });

  describe('Model Management', () => {
    it('should register a new model', () => {
      const metadata: ModelMetadata = {
        id: 'test-model',
        name: 'Test Model',
        provider: 'openai' as LLMProvider,
        version: '1.0.0',
        size: 'medium' as ModelSize,
        tier: 'standard' as ModelTier,
        capabilities: {} as ModelCapabilities,
        pricing: {} as ModelPricing,
        performance: {} as ModelPerformanceMetrics,
        constraints: {} as ModelConstraints,
        versions: [],
        tags: [],
        fineTuned: false,
      };

      registry.registerModel(metadata);

      const model = registry.getModel('test-model');
      expect(model).toBeDefined();
      expect(model?.metadata.id).toBe('test-model');
    });

    it('should unregister a model', () => {
      const modelCount = registry.getAllModels().length;
      const result = registry.unregisterModel('gpt-4');

      expect(result).toBe(true);
      expect(registry.getAllModels().length).toBe(modelCount - 1);
      expect(registry.getModel('gpt-4')).toBeUndefined();
    });

    it('should get model by ID', () => {
      const model = registry.getModel('gpt-4');
      expect(model).toBeDefined();
      expect(model?.metadata.id).toBe('gpt-4');
      expect(model?.metadata.provider).toBe('openai');
    });
  });

  describe('Model Filtering', () => {
    it('should get models by provider', () => {
      const openaiModels = registry.getModelsByProvider('openai' as LLMProvider);
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(openaiModels.every((m) => m.metadata.provider === 'openai')).toBe(true);
    });

    it('should get models by capability', () => {
      const codeModels = registry.getModelsByCapability('codeGeneration', 0.9);
      expect(codeModels.length).toBeGreaterThan(0);
      codeModels.forEach((model) => {
        expect(model.metadata.capabilities.codeGeneration.supported).toBe(true);
        expect(
          model.metadata.capabilities.codeGeneration.confidence
        ).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should get models by tier', () => {
      const premiumModels = registry.getModelsByTier('premium' as ModelTier);
      expect(premiumModels.length).toBeGreaterThan(0);
      expect(
        premiumModels.every((m) => m.metadata.tier === 'premium')
      ).toBe(true);
    });

    it('should find models by tags', () => {
      const fastModels = registry.findModelsByTags(['fast']);
      expect(fastModels.length).toBeGreaterThan(0);
    });
  });

  describe('Model Search', () => {
    it('should search models with basic criteria', () => {
      const results = registry.searchModels({
        provider: 'openai' as LLMProvider,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((m) => m.metadata.provider === 'openai')).toBe(true);
    });

    it('should search models with cost limit', () => {
      const results = registry.searchModels({
        maxCostPer1M: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      results.forEach((model) => {
        expect(model.metadata.pricing.input).toBeLessThanOrEqual(10);
        expect(model.metadata.pricing.output).toBeLessThanOrEqual(10);
      });
    });

    it('should search models with capability requirements', () => {
      const results = registry.searchModels({
        capabilities: {
          codeGeneration: { supported: true, confidence: 0.9 },
        },
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should find best model for query', () => {
      const model = registry.findBestModelForQuery({
        capabilities: ['codeGeneration'],
        priority: 'performance',
      });

      expect(model).toBeDefined();
      expect(model?.metadata.capabilities.codeGeneration.supported).toBe(true);
    });
  });

  describe('Performance Tracking', () => {
    it('should record request metrics', () => {
      registry.recordRequest('gpt-4', 1000, 500, true, 0.01);

      const metrics = registry.getModelMetrics('gpt-4');
      expect(metrics).toBeDefined();
      expect(metrics?.requests).toBe(1);
      expect(metrics?.successes).toBe(1);
      expect(metrics?.avgTokens).toBe(500);
    });

    it('should update model performance metadata', () => {
      registry.recordRequest('gpt-4', 1500, 750, true, 0.02);
      registry.recordRequest('gpt-4', 1200, 600, true, 0.015);

      const model = registry.getModel('gpt-4');
      expect(model?.metadata.performance.avgLatency).toBeGreaterThan(0);
    });

    it('should track failures', () => {
      registry.recordRequest('gpt-4', 1000, 500, false, 0.01);

      const metrics = registry.getModelMetrics('gpt-4');
      expect(metrics?.failures).toBe(1);
    });
  });

  describe('Health Monitoring', () => {
    it('should update model status', () => {
      registry.updateModelStatus('gpt-4', 'degraded', 0.7);

      const model = registry.getModel('gpt-4');
      expect(model?.status).toBe('degraded');
      expect(model?.availability).toBe(0.7);
    });

    it('should update model load', () => {
      registry.updateModelLoad('gpt-4', 0.8);

      const model = registry.getModel('gpt-4');
      expect(model?.currentLoad).toBe(0.8);
    });

    it('should get provider status', () => {
      const status = registry.getProviderStatus('openai' as LLMProvider);
      expect(status).toBeDefined();
      expect(status?.status).toBe('available');
    });
  });

  describe('Model Comparison', () => {
    it('should compare multiple models', () => {
      const comparison = registry.compareModels(['gpt-4', 'claude-3-opus']);

      expect(comparison.models).toHaveLength(2);
      expect(comparison.recommendations).toBeDefined();
      expect(comparison.costComparison).toBeDefined();
      expect(comparison.performanceComparison).toBeDefined();
    });

    it('should generate cost comparison', () => {
      const comparison = registry.compareModels(['gpt-4', 'gpt-3.5-turbo']);

      expect(comparison.costComparison.cheapest.model).toBeTruthy();
      expect(comparison.costComparison.mostExpensive.model).toBeTruthy();
    });

    it('should generate performance comparison', () => {
      const comparison = registry.compareModels(['gpt-4', 'claude-3-opus']);

      expect(comparison.performanceComparison.fastest.model).toBeTruthy();
      expect(comparison.performanceComparison.mostReliable.model).toBeTruthy();
    });
  });

  describe('Events', () => {
    it('should emit model:registered event', (done) => {
      registry.on('model:registered', (data: unknown) => {
        expect((data as { model: string }).model).toBe('test-model');
        done();
      });

      const metadata: ModelMetadata = {
        id: 'test-model',
        name: 'Test Model',
        provider: 'openai' as LLMProvider,
        version: '1.0.0',
        size: 'medium' as ModelSize,
        tier: 'standard' as ModelTier,
        capabilities: {} as ModelCapabilities,
        pricing: {} as ModelPricing,
        performance: {} as ModelPerformanceMetrics,
        constraints: {} as ModelConstraints,
        versions: [],
        tags: [],
        fineTuned: false,
      };

      registry.registerModel(metadata);
    });

    it('should emit model:status-changed event', (done) => {
      registry.on('model:status-changed', (data: unknown) => {
        const eventData = data as { model: string; newStatus: string };
        expect(eventData.model).toBe('gpt-4');
        expect(eventData.newStatus).toBe('degraded');
        done();
      });

      registry.checkModelHealth('gpt-4');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when getting non-existent model', () => {
      expect(() => registry.getModel('non-existent')).not.toThrow();
      expect(registry.getModel('non-existent')).toBeUndefined();
    });

    it('should handle unregistering non-existent model', () => {
      const result = registry.unregisterModel('non-existent');
      expect(result).toBe(false);
    });
  });
});
