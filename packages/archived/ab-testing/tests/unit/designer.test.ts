/**
 * Unit tests for Experiment Designer
 */

import { describe, it, expect } from 'vitest';
import { ExperimentDesigner } from '../../src/designer/designer';
import { ValidationError, ConfigurationError } from '../../src/types/errors';

describe('ExperimentDesigner', () => {
  let designer: ExperimentDesigner;

  beforeEach(() => {
    designer = new ExperimentDesigner();
  });

  describe('createExperiment', () => {
    it('should create a valid experiment', () => {
      const experiment = designer.createExperiment({
        id: 'test-exp-1',
        name: 'Test Experiment',
        description: 'A test experiment',
        hypothesis: {
          title: 'Test Hypothesis',
          description: 'Testing hypothesis',
          expectedOutcome: 'Positive outcome',
          rationale: 'Because science',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Control variant',
            parameters: { color: 'blue' },
            isControl: true
          },
          {
            id: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            parameters: { color: 'red' }
          }
        ],
        metrics: [
          {
            id: 'conversion',
            name: 'Conversion Rate',
            description: 'Users who convert',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ],
        tags: ['test']
      });

      expect(experiment.id).toBe('test-exp-1');
      expect(experiment.name).toBe('Test Experiment');
      expect(experiment.variants).toHaveLength(2);
      expect(experiment.metrics).toHaveLength(1);
      expect(experiment.targetSampleSize).toBeGreaterThan(0);
    });

    it('should calculate equal weights for variants', () => {
      const experiment = designer.createExperiment({
        id: 'test-exp-2',
        name: 'Test Experiment',
        description: 'A test experiment',
        hypothesis: {
          title: 'Test',
          description: 'Test',
          expectedOutcome: 'Test',
          rationale: 'Test',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'Variant 1',
            description: 'First variant',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'Variant 2',
            description: 'Second variant',
            parameters: {}
          },
          {
            id: 'v3',
            name: 'Variant 3',
            description: 'Third variant',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'metric',
            name: 'Metric',
            description: 'Test metric',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const weightSum = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
      expect(weightSum).toBeCloseTo(1, 4);
      expect(experiment.variants[0].weight).toBeCloseTo(1/3, 4);
    });
  });

  describe('createHypothesis', () => {
    it('should create a valid hypothesis', () => {
      const hypothesis = designer.createHypothesis({
        title: 'Test Hypothesis',
        description: 'Testing hypothesis',
        expectedOutcome: 'Positive outcome',
        rationale: 'Because science',
        expectedEffectSize: 0.1,
        riskAssessment: 'Low risk'
      });

      expect(hypothesis.title).toBe('Test Hypothesis');
      expect(hypothesis.expectedEffectSize).toBe(0.1);
      expect(hypothesis.riskAssessment).toBe('Low risk');
    });

    it('should use default values', () => {
      const hypothesis = designer.createHypothesis({
        title: 'Test',
        description: 'Test',
        expectedOutcome: 'Test',
        rationale: 'Test'
      });

      expect(hypothesis.expectedEffectSize).toBe(0.05);
      expect(hypothesis.riskAssessment).toBe('Low risk - reversible change');
    });
  });

  describe('createMetric', () => {
    it('should create a valid metric', () => {
      const metric = designer.createMetric({
        id: 'revenue',
        name: 'Revenue',
        description: 'Total revenue',
        type: 'continuous',
        direction: 'higher_is_better',
        primary: true,
        minimumDetectableEffect: 10,
        power: 0.9,
        alpha: 0.01
      });

      expect(metric.id).toBe('revenue');
      expect(metric.type).toBe('continuous');
      expect(metric.primary).toBe(true);
      expect(metric.minimumDetectableEffect).toBe(10);
      expect(metric.power).toBe(0.9);
      expect(metric.alpha).toBe(0.01);
    });
  });

  describe('validateExperiment', () => {
    it('should validate a correct experiment', () => {
      const experiment = designer.createExperiment({
        id: 'valid-exp',
        name: 'Valid Experiment',
        description: 'A valid experiment',
        hypothesis: {
          title: 'Valid',
          description: 'Valid',
          expectedOutcome: 'Valid',
          rationale: 'Valid',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Control',
            parameters: {},
            isControl: true
          },
          {
            id: 'treatment',
            name: 'Treatment',
            description: 'Treatment',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'conversion',
            name: 'Conversion',
            description: 'Conversion rate',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const validation = designer.validateExperiment(experiment);

      expect(validation.valid).toBe(true);
      expect(validation.errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    it('should detect missing control variant', () => {
      const experiment = designer.createExperiment({
        id: 'invalid-exp',
        name: 'Invalid Experiment',
        description: 'Invalid experiment',
        hypothesis: {
          title: 'Invalid',
          description: 'Invalid',
          expectedOutcome: 'Invalid',
          rationale: 'Invalid',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'Variant 1',
            description: 'Variant 1',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'Variant 2',
            description: 'Variant 2',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'metric',
            name: 'Metric',
            description: 'Metric',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const validation = designer.validateExperiment(experiment);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes('control'))).toBe(true);
    });

    it('should detect invalid weights', () => {
      const experiment = designer.createExperiment({
        id: 'weight-exp',
        name: 'Weight Experiment',
        description: 'Test weights',
        hypothesis: {
          title: 'Weight',
          description: 'Weight',
          expectedOutcome: 'Weight',
          rationale: 'Weight',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Control',
            parameters: {},
            isControl: true
          },
          {
            id: 'treatment',
            name: 'Treatment',
            description: 'Treatment',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'metric',
            name: 'Metric',
            description: 'Metric',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      // Manually corrupt weights
      experiment.variants[0].weight = 0.3;
      experiment.variants[1].weight = 0.3;

      const validation = designer.validateExperiment(experiment);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.message.includes('sum to 1'))).toBe(true);
    });
  });

  describe('calculateSampleSize', () => {
    it('should calculate sample size for binary metric', () => {
      const sampleSize = designer.calculateSampleSize({
        baselineRate: 0.1,
        minimumDetectableEffect: 0.02,
        power: 0.8,
        alpha: 0.05,
        variantsCount: 2
      });

      expect(sampleSize).toBeGreaterThan(0);
      expect(sampleSize).toBeGreaterThan(100);
    });

    it('should require larger sample for smaller effect', () => {
      const largeEffect = designer.calculateSampleSize({
        baselineRate: 0.1,
        minimumDetectableEffect: 0.1,
        power: 0.8,
        alpha: 0.05,
        variantsCount: 2
      });

      const smallEffect = designer.calculateSampleSize({
        baselineRate: 0.1,
        minimumDetectableEffect: 0.02,
        power: 0.8,
        alpha: 0.05,
        variantsCount: 2
      });

      expect(smallEffect).toBeGreaterThan(largeEffect);
    });
  });

  describe('estimateDuration', () => {
    it('should estimate duration based on traffic', () => {
      const duration = designer.estimateDuration({
        requiredSampleSize: 1000,
        dailyTraffic: 500,
        allocationPercentage: 1
      });

      // Should be 2 days in milliseconds
      expect(duration).toBe(2 * 24 * 60 * 60 * 1000);
    });

    it('should account for allocation percentage', () => {
      const fullDuration = designer.estimateDuration({
        requiredSampleSize: 1000,
        dailyTraffic: 1000,
        allocationPercentage: 1
      });

      const halfDuration = designer.estimateDuration({
        requiredSampleSize: 1000,
        dailyTraffic: 1000,
        allocationPercentage: 0.5
      });

      expect(halfDuration).toBe(fullDuration * 2);
    });
  });

  describe('generateDesignSummary', () => {
    it('should generate comprehensive summary', () => {
      const experiment = designer.createExperiment({
        id: 'summary-exp',
        name: 'Summary Experiment',
        description: 'Test summary',
        hypothesis: {
          title: 'Summary',
          description: 'Summary',
          expectedOutcome: 'Summary',
          rationale: 'Summary',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'control',
            name: 'Control',
            description: 'Control',
            parameters: {},
            isControl: true
          },
          {
            id: 'treatment',
            name: 'Treatment',
            description: 'Treatment',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'conversion',
            name: 'Conversion',
            description: 'Conversion rate',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const summary = designer.generateDesignSummary(experiment);

      expect(summary.config).toBe(experiment);
      expect(summary.validation).toBeDefined();
      expect(summary.sampleSizeRequirements).toBeDefined();
      expect(summary.considerations).toBeDefined();
      expect(summary.considerations.length).toBeGreaterThan(0);
    });
  });

  describe('updateVariantWeights', () => {
    it('should update weights correctly', () => {
      const experiment = designer.createExperiment({
        id: 'weight-exp',
        name: 'Weight Experiment',
        description: 'Test',
        hypothesis: {
          title: 'Test',
          description: 'Test',
          expectedOutcome: 'Test',
          rationale: 'Test',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'V1',
            description: 'V1',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'V2',
            description: 'V2',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'm',
            name: 'M',
            description: 'M',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const updated = designer.updateVariantWeights(experiment, {
        v1: 0.7,
        v2: 0.3
      });

      expect(updated.variants[0].weight).toBe(0.7);
      expect(updated.variants[1].weight).toBe(0.3);
    });

    it('should reject invalid weights', () => {
      const experiment = designer.createExperiment({
        id: 'weight-exp',
        name: 'Weight Experiment',
        description: 'Test',
        hypothesis: {
          title: 'Test',
          description: 'Test',
          expectedOutcome: 'Test',
          rationale: 'Test',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'V1',
            description: 'V1',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'V2',
            description: 'V2',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'm',
            name: 'M',
            description: 'M',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      expect(() => {
        designer.updateVariantWeights(experiment, {
          v1: 0.8,
          v2: 0.3 // Sum = 1.1
        });
      }).toThrow();
    });
  });

  describe('addVariant', () => {
    it('should add variant and rebalance weights', () => {
      const experiment = designer.createExperiment({
        id: 'add-exp',
        name: 'Add Experiment',
        description: 'Test',
        hypothesis: {
          title: 'Test',
          description: 'Test',
          expectedOutcome: 'Test',
          rationale: 'Test',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'V1',
            description: 'V1',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'V2',
            description: 'V2',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'm',
            name: 'M',
            description: 'M',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const updated = designer.addVariant(experiment, {
        id: 'v3',
        name: 'V3',
        description: 'V3',
        parameters: {}
      });

      expect(updated.variants).toHaveLength(3);

      const sum = updated.variants.reduce((s, v) => s + v.weight, 0);
      expect(sum).toBeCloseTo(1, 4);
    });
  });

  describe('removeVariant', () => {
    it('should remove variant and rebalance', () => {
      const experiment = designer.createExperiment({
        id: 'remove-exp',
        name: 'Remove Experiment',
        description: 'Test',
        hypothesis: {
          title: 'Test',
          description: 'Test',
          expectedOutcome: 'Test',
          rationale: 'Test',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'V1',
            description: 'V1',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'V2',
            description: 'V2',
            parameters: {}
          },
          {
            id: 'v3',
            name: 'V3',
            description: 'V3',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'm',
            name: 'M',
            description: 'M',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const updated = designer.removeVariant(experiment, 'v3');

      expect(updated.variants).toHaveLength(2);
      expect(updated.variants.find(v => v.id === 'v3')).toBeUndefined();
    });

    it('should prevent removing if only 2 variants', () => {
      const experiment = designer.createExperiment({
        id: 'remove-exp',
        name: 'Remove Experiment',
        description: 'Test',
        hypothesis: {
          title: 'Test',
          description: 'Test',
          expectedOutcome: 'Test',
          rationale: 'Test',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'V1',
            description: 'V1',
            parameters: {}
          },
          {
            id: 'v2',
            name: 'V2',
            description: 'V2',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'm',
            name: 'M',
            description: 'M',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      expect(() => {
        designer.removeVariant(experiment, 'v2');
      }).toThrow(ConfigurationError);
    });
  });

  describe('cloneExperiment', () => {
    it('should clone experiment with new ID', () => {
      const original = designer.createExperiment({
        id: 'original',
        name: 'Original',
        description: 'Original',
        hypothesis: {
          title: 'Original',
          description: 'Original',
          expectedOutcome: 'Original',
          rationale: 'Original',
          expectedEffectSize: 0.05
        },
        variants: [
          {
            id: 'v1',
            name: 'V1',
            description: 'V1',
            parameters: {}
          }
        ],
        metrics: [
          {
            id: 'm',
            name: 'M',
            description: 'M',
            type: 'binary',
            direction: 'higher_is_better',
            primary: true
          }
        ]
      });

      const clone = designer.cloneExperiment(original, 'cloned');

      expect(clone.id).toBe('cloned');
      expect(clone.name).toBe('Original (Copy)');
      expect(clone.variants).toEqual(original.variants);
      expect(clone.startTime).toBeUndefined();
    });
  });
});
