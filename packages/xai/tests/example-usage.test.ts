/**
 * Example usage and integration tests for XAI system
 */

import { describe, it, expect } from '@jest/globals';
import {
  KernelSHAP,
  TabularLIME,
  AttentionVisualizer,
  CounterfactualGenerator,
  ModelInterpreter,
  ExplanationReporter,
  type ModelMetadata,
} from '../src';

// Mock model for testing
class MockModel {
  async predict(input: Record<string, any>): Promise<number> {
    // Simple mock: weighted sum
    return (input.feature1 || 0) * 0.5 + (input.feature2 || 0) * 0.3 + (input.feature3 || 0) * 0.2;
  }

  async predictBatch(inputs: Record<string, any>[]): Promise<number[]> {
    return Promise.all(inputs.map(i => this.predict(i)));
  }

  getMetadata(): ModelMetadata {
    return {
      modelInfo: {
        id: 'mock-model-1',
        name: 'Mock Classification Model',
        type: 'classification',
        version: '1.0.0',
        inputShape: [3],
        outputShape: [1],
        parameters: 100,
        trainable: true,
      },
      featureNames: ['feature1', 'feature2', 'feature3'],
      featureTypes: [
        { name: 'feature1', type: 'numeric', range: [0, 1], nullable: false },
        { name: 'feature2', type: 'numeric', range: [0, 1], nullable: false },
        { name: 'feature3', type: 'numeric', range: [0, 1], nullable: false },
      ],
      hyperparameters: { learningRate: 0.01, epochs: 100 },
      performanceMetrics: {
        accuracy: 0.85,
        precision: 0.82,
        recall: 0.88,
        f1Score: 0.85,
      },
    };
  }
}

describe('XAI System Integration Tests', () => {
  const model = new MockModel();
  const metadata = model.getMetadata();

  describe('SHAP Explanation', () => {
    it('should generate SHAP values for an instance', async () => {
      const shap = new KernelSHAP(metadata, {
        backgroundSize: 50,
        maxSamples: 500,
      });

      const instance = {
        feature1: 0.8,
        feature2: 0.3,
        feature3: 0.5,
      };

      const explanation = await shap.explain(instance, async (samples) => {
        return model.predictBatch(samples);
      });

      expect(explanation).toBeDefined();
      expect(explanation.id).toBeDefined();
      expect(explanation.features).toHaveLength(3);
      expect(explanation.method).toBe('kernel');
      expect(explanation.shapValues.values).toHaveLength(3);
    });

    it('should generate SHAP explanations for multiple instances', async () => {
      const shap = new KernelSHAP(metadata);

      const instances = [
        { feature1: 0.5, feature2: 0.5, feature3: 0.5 },
        { feature1: 0.8, feature2: 0.2, feature3: 0.6 },
        { feature1: 0.2, feature2: 0.9, feature3: 0.3 },
      ];

      const explanations = await shap.explainBatch(instances, async (samples) => {
        return model.predictBatch(samples);
      });

      expect(explanations).toHaveLength(3);
      expect(explanations[0].features).toHaveLength(3);
    });

    it('should calculate feature importance rankings', async () => {
      const shap = new KernelSHAP(metadata);

      const instance = { feature1: 0.7, feature2: 0.4, feature3: 0.6 };

      const explanation = await shap.explain(instance, async (samples) => {
        return model.predictBatch(samples);
      });

      const importance = shap.getFeatureImportance(explanation);

      expect(importance).toHaveLength(3);
      expect(importance[0].importance).toBeGreaterThanOrEqual(importance[1].importance);
    });
  });

  describe('LIME Explanation', () => {
    it('should generate LIME explanation for an instance', async () => {
      const lime = new TabularLIME(metadata, {
        numSamples: 1000,
        kernelWidth: 0.75,
      });

      const instance = {
        feature1: 0.8,
        feature2: 0.3,
        feature3: 0.5,
      };

      const explanation = await lime.explain(instance, async (samples) => {
        return model.predictBatch(samples);
      });

      expect(explanation).toBeDefined();
      expect(explanation.id).toBeDefined();
      expect(explanation.features).toHaveLength(3);
      expect(explanation.method).toBe('tabular');
      expect(explanation.score).toBeGreaterThanOrEqual(0);
      expect(explanation.score).toBeLessThanOrEqual(1);
    });

    it('should calculate feature importance from LIME', async () => {
      const lime = new TabularLIME(metadata);

      const instance = { feature1: 0.7, feature2: 0.4, feature3: 0.6 };

      const explanation = await lime.explain(instance, async (samples) => {
        return model.predictBatch(samples);
      });

      const importance = lime.getFeatureImportance(explanation);

      expect(importance).toHaveLength(3);
      expect(importance[0].importance).toBeGreaterThanOrEqual(importance[1].importance);
    });
  });

  describe('Attention Visualization', () => {
    it('should visualize attention patterns', async () => {
      const visualizer = new AttentionVisualizer({
        layer: 0,
        head: 0,
        normalization: 'softmax',
      });

      // Mock attention weights: 6x6 matrix for 6 tokens
      const attentionWeights = [
        [
          Array(6).fill(0).map(() => Math.random()),
        ],
      ];

      const tokens = ['The', 'cat', 'sat', 'on', 'the', 'mat'];

      const visualization = await visualizer.visualize(attentionWeights, tokens);

      expect(visualization).toBeDefined();
      expect(visualization).toHaveLength(1);
      expect(visualization[0].layer).toBe(0);
      expect(visualization[0].head).toBe(0);
      expect(visualization[0].tokens).toEqual(tokens);
      expect(visualization[0].patterns).toBeDefined();
    });

    it('should aggregate attention across layers and heads', async () => {
      const visualizer = new AttentionVisualizer({
        aggregateLayers: true,
        aggregateHeads: true,
      });

      // Mock multi-head, multi-layer attention
      const attentionWeights = [
        [
          Array(6).fill(0).map(() => Array(6).fill(0).map(() => Math.random())),
          Array(6).fill(0).map(() => Array(6).fill(0).map(() => Math.random())),
        ],
        [
          Array(6).fill(0).map(() => Array(6).fill(0).map(() => Math.random())),
          Array(6).fill(0).map(() => Array(6).fill(0).map(() => Math.random())),
        ],
      ];

      const tokens = ['The', 'cat', 'sat', 'on', 'the', 'mat'];

      const visualization = await visualizer.visualize(attentionWeights, tokens);

      expect(visualization).toHaveLength(1);
      expect(visualization[0].patterns).toBeDefined();
    });

    it('should calculate attention metrics', () => {
      const visualizer = new AttentionVisualizer();

      const weights = Array(6).fill(0).map(() =>
        Array(6).fill(0).map(() => Math.random())
      );

      const metrics = visualizer.calculateMetrics(weights);

      expect(metrics.entropy).toBeGreaterThanOrEqual(0);
      expect(metrics.entropy).toBeLessThanOrEqual(1);
      expect(metrics.sparsity).toBeGreaterThanOrEqual(0);
      expect(metrics.sparsity).toBeLessThanOrEqual(1);
      expect(metrics.focus).toBeGreaterThanOrEqual(0);
      expect(metrics.focus).toBeLessThanOrEqual(1);
    });
  });

  describe('Counterfactual Generation', () => {
    it('should generate counterfactual examples', async () => {
      const generator = new CounterfactualGenerator(metadata, {
        method: 'genetic',
        numCandidates: 5,
        maxIterations: 100,
      });

      const instance = {
        feature1: 0.5,
        feature2: 0.5,
        feature3: 0.5,
      };

      const currentPrediction = await model.predict(instance);
      const targetPrediction = 0.9; // Higher value

      const counterfactuals = await generator.generate(
        instance,
        currentPrediction,
        targetPrediction,
        async (features) => model.predict(features)
      );

      expect(counterfactuals).toBeDefined();
      expect(Array.isArray(counterfactuals)).toBe(true);
    });

    it('should generate actionable recommendations', async () => {
      const generator = new CounterfactualGenerator(metadata);

      const instance = { feature1: 0.3, feature2: 0.4, feature3: 0.5 };

      const currentPrediction = await model.predict(instance);
      const targetPrediction = 0.8;

      const counterfactuals = await generator.generate(
        instance,
        currentPrediction,
        targetPrediction,
        async (features) => model.predict(features)
      );

      if (counterfactuals.length > 0) {
        const recommendations = generator.generateRecommendations(counterfactuals);

        expect(recommendations).toBeDefined();
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Model Interpretation', () => {
    it('should generate comprehensive model interpretation', async () => {
      const interpreter = new ModelInterpreter(model);

      const instances = [
        { feature1: 0.5, feature2: 0.5, feature3: 0.5 },
        { feature1: 0.8, feature2: 0.2, feature3: 0.6 },
        { feature1: 0.2, feature2: 0.9, feature3: 0.3 },
        { feature1: 0.6, feature2: 0.4, feature3: 0.7 },
      ];

      const interpretation = await interpreter.interpret(instances, {
        includeGlobal: true,
        includeLocal: true,
        includeBias: true,
        includeFairness: true,
      });

      expect(interpretation).toBeDefined();
      expect(interpretation.modelId).toBe('mock-model-1');
      expect(interpretation.localExplanations).toBeDefined();
      expect(interpretation.globalExplanation).toBeDefined();
      expect(interpretation.summary).toBeDefined();
      expect(interpretation.recommendations).toBeDefined();
    });
  });

  describe('Explanation Reporting', () => {
    it('should generate comprehensive explanation report', async () => {
      const reporter = new ExplanationReporter();

      const shap = new KernelSHAP(metadata);
      const instance = { feature1: 0.7, feature2: 0.4, feature3: 0.6 };

      const shapExplanation = await shap.explain(instance, async (samples) => {
        return model.predictBatch(samples);
      });

      const report = await reporter.generateReport({
        shap: shapExplanation,
      });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.confidence).toBeGreaterThanOrEqual(0);
      expect(report.confidence).toBeLessThanOrEqual(1);
    });

    it('should export report in different formats', async () => {
      const reporter = new ExplanationReporter();

      const report = await reporter.generateReport({});

      const html = await reporter.exportReport(report, 'html');
      const json = await reporter.exportReport(report, 'json');
      const markdown = await reporter.exportReport(report, 'markdown');
      const text = await reporter.exportReport(report, 'text');

      expect(html).toContain('<!DOCTYPE html>');
      expect(json).toContain('"id"');
      expect(markdown).toContain('#');
      expect(text).toContain('MODEL EXPLANATION REPORT');
    });

    it('should generate natural language explanations', async () => {
      const reporter = new ExplanationReporter();

      const shap = new KernelSHAP(metadata);
      const instance = { feature1: 0.7, feature2: 0.4, feature3: 0.6 };

      const shapExplanation = await shap.explain(instance, async (samples) => {
        return model.predictBatch(samples);
      });

      const nlExplanation = await reporter.generateNLExplanation(
        { shap: shapExplanation },
        {
          tone: 'formal',
          length: 'medium',
          includeTechnicalDetails: true,
          includeExamples: false,
          includeCaveats: true,
        }
      );

      expect(nlExplanation).toBeDefined();
      expect(nlExplanation.summary).toBeDefined();
      expect(nlExplanation.detailedExplanation).toBeDefined();
      expect(nlExplanation.keyFindings).toBeDefined();
      expect(nlExplanation.recommendations).toBeDefined();
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full XAI workflow', async () => {
      const instances = [
        { feature1: 0.7, feature2: 0.4, feature3: 0.6 },
        { feature1: 0.3, feature2: 0.8, feature3: 0.4 },
      ];

      // 1. Generate SHAP explanations
      const shap = new KernelSHAP(metadata);
      const shapExplanations = await shap.explainBatch(instances, async (samples) => {
        return model.predictBatch(samples);
      });

      // 2. Generate LIME explanations
      const lime = new TabularLIME(metadata);
      const limeExplanations = await lime.explainBatch(instances, async (samples) => {
        return model.predictBatch(samples);
      });

      // 3. Generate counterfactuals
      const cfGenerator = new CounterfactualGenerator(metadata);
      const counterfactuals = await cfGenerator.generate(
        instances[0],
        await model.predict(instances[0]),
        0.9,
        async (features) => model.predict(features)
      );

      // 4. Comprehensive interpretation
      const interpreter = new ModelInterpreter(model);
      const interpretation = await interpreter.interpret(instances);

      // 5. Generate report
      const reporter = new ExplanationReporter();
      const report = await reporter.generateReport({
        shap: shapExplanations[0],
        lime: limeExplanations[0],
        global: interpretation.globalExplanation,
        local: interpretation.localExplanations,
      });

      // Verify all components
      expect(shapExplanations).toHaveLength(2);
      expect(limeExplanations).toHaveLength(2);
      expect(interpretation.globalExplanation).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});
