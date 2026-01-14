/**
 * Experiment Designer - Creates and configures A/B test experiments
 * with proper statistical design, sample size calculation, and duration planning
 */

import type {
  ExperimentConfig,
  ExperimentId,
  ExperimentStatus,
  Hypothesis,
  MetricDefinition,
  MetricDirection,
  MetricType,
  VariantDefinition,
  SampleSizeParams,
  TargetingCriteria
} from '../types/experiment.js';
import {
  ValidationError,
  ConfigurationError,
  InvalidDurationError,
  InvalidWeightsError
} from '../types/errors.js';
import { SampleSizeCalculator } from '../utils/sample-size.js';

/**
 * Experiment designer configuration
 */
export interface DesignerConfig {
  /** Default significance level (alpha) */
  defaultAlpha?: number;
  /** Default statistical power */
  defaultPower?: number;
  /** Default minimum duration (milliseconds) */
  defaultMinDuration?: number;
  /** Default maximum duration (milliseconds) */
  defaultMaxDuration?: number;
  /** Minimum sample size per variant */
  minSampleSize?: number;
  /** Maximum number of variants */
  maxVariants?: number;
  /** Maximum number of metrics */
  maxMetrics?: number;
}

/**
 * Experiment validation result
 */
export interface ValidationResult {
  /** Whether the experiment is valid */
  valid: boolean;
  /** Validation errors */
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Experiment design summary
 */
export interface DesignSummary {
  /** Experiment configuration */
  config: ExperimentConfig;
  /** Validation results */
  validation: ValidationResult;
  /** Sample size requirements */
  sampleSizeRequirements: {
    perVariant: number;
    total: number;
    estimatedDuration: number;
    powerAchieved: number;
  };
  /** Statistical considerations */
  considerations: string[];
}

/**
 * Experiment Designer class
 */
export class ExperimentDesigner {
  private config: Required<DesignerConfig>;

  constructor(config: DesignerConfig = {}) {
    this.config = {
      defaultAlpha: config.defaultAlpha ?? 0.05,
      defaultPower: config.defaultPower ?? 0.8,
      defaultMinDuration: config.defaultMinDuration ?? 7 * 24 * 60 * 60 * 1000, // 1 week
      defaultMaxDuration: config.defaultMaxDuration ?? 30 * 24 * 60 * 60 * 1000, // 30 days
      minSampleSize: config.minSampleSize ?? 100,
      maxVariants: config.maxVariants ?? 10,
      maxMetrics: config.maxMetrics ?? 20
    };
  }

  /**
   * Create a new experiment configuration
   */
  createExperiment(params: {
    id: ExperimentId;
    name: string;
    description: string;
    hypothesis: Omit<Hypothesis, 'expectedEffectSize'>;
    variants: Omit<VariantDefinition, 'weight'>[];
    metrics: Omit<MetricDefinition, 'minimumDetectableEffect' | 'power' | 'alpha'>[];
    targeting?: TargetingCriteria;
    tags?: string[];
  }): ExperimentConfig {
    const { id, name, description, hypothesis, variants, metrics, targeting, tags } = params;

    // Calculate weights for variants (equal distribution by default)
    const weightedVariants: VariantDefinition[] = variants.map((variant, index) => ({
      ...variant,
      weight: 1 / variants.length
    }));

    // Calculate sample size requirements
    const sampleSizeParams: SampleSizeParams = {
      minimumDetectableEffect: hypothesis.expectedEffectSize ?? 0.05,
      power: this.config.defaultPower,
      alpha: this.config.defaultAlpha,
      variantsCount: variants.length
    };

    const calculator = new SampleSizeCalculator();
    const targetSampleSize = calculator.calculateSampleSize(sampleSizeParams);

    return {
      id,
      name,
      description,
      hypothesis: {
        ...hypothesis,
        expectedEffectSize: hypothesis.expectedEffectSize ?? 0.05
      },
      variants: weightedVariants,
      metrics: metrics.map(metric => ({
        ...metric,
        minimumDetectableEffect: metric.minimumDetectableEffect ?? 0.05,
        power: metric.power ?? this.config.defaultPower,
        alpha: metric.alpha ?? this.config.defaultAlpha
      })),
      allocationStrategy: 'equal',
      targetSampleSize,
      minimumDuration: this.config.defaultMinDuration,
      maximumDuration: this.config.defaultMaxDuration,
      targeting,
      tags: tags ?? []
    };
  }

  /**
   * Create a hypothesis with proper structure
   */
  createHypothesis(params: {
    title: string;
    description: string;
    expectedOutcome: string;
    rationale: string;
    expectedEffectSize?: number;
    riskAssessment?: string;
  }): Hypothesis {
    return {
      title: params.title,
      description: params.description,
      expectedOutcome: params.expectedOutcome,
      rationale: params.rationale,
      expectedEffectSize: params.expectedEffectSize ?? 0.05,
      riskAssessment: params.riskAssessment ?? 'Low risk - reversible change'
    };
  }

  /**
   * Create a metric definition
   */
  createMetric(params: {
    id: string;
    name: string;
    description: string;
    type: MetricType;
    direction: MetricDirection;
    primary?: boolean;
    minimumDetectableEffect?: number;
    power?: number;
    alpha?: number;
  }): MetricDefinition {
    return {
      id: params.id,
      name: params.name,
      description: params.description,
      type: params.type,
      direction: params.direction,
      primary: params.primary ?? false,
      minimumDetectableEffect: params.minimumDetectableEffect ?? 0.05,
      power: params.power ?? this.config.defaultPower,
      alpha: params.alpha ?? this.config.defaultAlpha
    };
  }

  /**
   * Create a variant definition
   */
  createVariant(params: {
    id: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    isControl?: boolean;
  }): VariantDefinition {
    return {
      id: params.id,
      name: params.name,
      description: params.description,
      weight: 0, // Will be calculated when added to experiment
      parameters: params.parameters,
      isControl: params.isControl ?? false
    };
  }

  /**
   * Validate experiment configuration
   */
  validateExperiment(config: ExperimentConfig): ValidationResult {
    const errors: ValidationResult['errors'] = [];
    const recommendations: string[] = [];

    // Validate experiment ID
    if (!config.id || config.id.trim().length === 0) {
      errors.push({
        field: 'id',
        message: 'Experiment ID is required',
        severity: 'error'
      });
    }

    // Validate name
    if (!config.name || config.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Experiment name is required',
        severity: 'error'
      });
    }

    // Validate variants
    if (config.variants.length < 2) {
      errors.push({
        field: 'variants',
        message: 'At least 2 variants are required',
        severity: 'error'
      });
    } else if (config.variants.length > this.config.maxVariants) {
      errors.push({
        field: 'variants',
        message: `Maximum ${this.config.maxVariants} variants allowed`,
        severity: 'error'
      });
    }

    // Validate control variant
    const controlVariants = config.variants.filter(v => v.isControl);
    if (controlVariants.length === 0) {
      errors.push({
        field: 'variants',
        message: 'At least one control variant is required',
        severity: 'error'
      });
    } else if (controlVariants.length > 1) {
      errors.push({
        field: 'variants',
        message: 'Only one control variant is allowed',
        severity: 'error'
      });
    }

    // Validate weights
    const weightSum = config.variants.reduce((sum, v) => sum + v.weight, 0);
    if (Math.abs(weightSum - 1) > 0.0001) {
      errors.push({
        field: 'variants',
        message: `Variant weights must sum to 1.0, current sum is ${weightSum.toFixed(4)}`,
        severity: 'error'
      });
    }

    // Validate metrics
    if (config.metrics.length === 0) {
      errors.push({
        field: 'metrics',
        message: 'At least one metric is required',
        severity: 'error'
      });
    } else if (config.metrics.length > this.config.maxMetrics) {
      errors.push({
        field: 'metrics',
        message: `Maximum ${this.config.maxMetrics} metrics allowed`,
        severity: 'error'
      });
    }

    // Validate primary metric
    const primaryMetrics = config.metrics.filter(m => m.primary);
    if (primaryMetrics.length === 0) {
      errors.push({
        field: 'metrics',
        message: 'At least one primary metric is required',
        severity: 'error'
      });
    } else if (primaryMetrics.length > 1) {
      errors.push({
        field: 'metrics',
        message: 'Only one primary metric is allowed',
        severity: 'error'
      });
    }

    // Validate sample size
    if (config.targetSampleSize < this.config.minSampleSize) {
      errors.push({
        field: 'targetSampleSize',
        message: `Target sample size must be at least ${this.config.minSampleSize}`,
        severity: 'error'
      });
    }

    // Validate duration
    if (config.minimumDuration >= config.maximumDuration) {
      errors.push({
        field: 'duration',
        message: 'Minimum duration must be less than maximum duration',
        severity: 'error'
      });
    }

    if (config.minimumDuration < 60 * 60 * 1000) {
      recommendations.push('Consider running for at least 1 hour to capture temporal variation');
    }

    if (config.maximumDuration > 90 * 24 * 60 * 60 * 1000) {
      recommendations.push('Consider limiting experiment to 90 days to avoid seasonal effects');
    }

    // Validate hypothesis
    if (!config.hypothesis || !config.hypothesis.title) {
      errors.push({
        field: 'hypothesis',
        message: 'Hypothesis title is required',
        severity: 'error'
      });
    }

    // Validate metric types and directions
    config.metrics.forEach(metric => {
      if (metric.type === 'binary' && metric.direction === 'neutral') {
        recommendations.push(`Binary metric ${metric.name} should specify higher_is_better or lower_is_better`);
      }
    });

    // Generate recommendations
    if (config.variants.length === 2) {
      recommendations.push('Consider adding more variants for deeper insights');
    }

    if (config.targetSampleSize < 1000) {
      recommendations.push('Larger sample sizes provide more reliable results');
    }

    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      recommendations
    };
  }

  /**
   * Calculate sample size for experiment
   */
  calculateSampleSize(params: {
    baselineRate?: number;
    minimumDetectableEffect: number;
    power?: number;
    alpha?: number;
    variantsCount: number;
  }): number {
    const calculator = new SampleSizeCalculator();
    return calculator.calculateSampleSize({
      baselineRate: params.baselineRate,
      minimumDetectableEffect: params.minimumDetectableEffect,
      power: params.power ?? this.config.defaultPower,
      alpha: params.alpha ?? this.config.defaultAlpha,
      variantsCount: params.variantsCount
    });
  }

  /**
   * Estimate experiment duration based on traffic
   */
  estimateDuration(params: {
    requiredSampleSize: number;
    dailyTraffic: number;
    allocationPercentage?: number;
  }): number {
    const { requiredSampleSize, dailyTraffic, allocationPercentage = 1 } = params;

    const dailyAllocated = dailyTraffic * allocationPercentage;
    const daysNeeded = Math.ceil(requiredSampleSize / dailyAllocated);

    // Add buffer for variance
    return daysNeeded * 24 * 60 * 60 * 1000; // Convert to milliseconds
  }

  /**
   * Generate a comprehensive design summary
   */
  generateDesignSummary(config: ExperimentConfig): DesignSummary {
    const validation = this.validateExperiment(config);

    const sampleSizeRequirements = {
      perVariant: config.targetSampleSize,
      total: config.targetSampleSize * config.variants.length,
      estimatedDuration: config.minimumDuration,
      powerAchieved: config.metrics[0]?.power ?? this.config.defaultPower
    };

    const considerations: string[] = [
      `Experiment requires ${sampleSizeRequirements.total} total participants`,
      `At least ${config.variants.filter(v => v.isControl).length} control variant identified`,
      `${config.metrics.filter(m => m.primary).length} primary metric will drive decision making`,
      `Significance level set to ${(config.metrics[0]?.alpha ?? this.config.defaultAlpha) * 100}%`,
      `Statistical power target: ${((config.metrics[0]?.power ?? this.config.defaultPower) * 100).toFixed(1)}%`
    ];

    if (config.targeting) {
      considerations.push('Experiment uses targeted user segments - ensure segment size is sufficient');
    }

    if (config.variants.length > 3) {
      considerations.push('Multiple variants - consider sequential testing or bandit approaches');
    }

    return {
      config,
      validation,
      sampleSizeRequirements,
      considerations
    };
  }

  /**
   * Clone an experiment configuration
   */
  cloneExperiment(config: ExperimentConfig, newId: ExperimentId): ExperimentConfig {
    return {
      ...JSON.parse(JSON.stringify(config)),
      id: newId,
      name: `${config.name} (Copy)`,
      startTime: undefined,
      endTime: undefined
    };
  }

  /**
   * Update variant weights
   */
  updateVariantWeights(
    config: ExperimentConfig,
    weights: Record<string, number>
  ): ExperimentConfig {
    const variants = config.variants.map(variant => ({
      ...variant,
      weight: weights[variant.id] ?? variant.weight
    }));

    const weightSum = variants.reduce((sum, v) => sum + v.weight, 0);

    if (Math.abs(weightSum - 1) > 0.0001) {
      throw new InvalidWeightsError(weightSum);
    }

    return {
      ...config,
      variants
    };
  }

  /**
   * Add a variant to an experiment
   */
  addVariant(
    config: ExperimentConfig,
    variant: Omit<VariantDefinition, 'weight'>
  ): ExperimentConfig {
    if (config.variants.length >= this.config.maxVariants) {
      throw new ConfigurationError(`Maximum ${this.config.maxVariants} variants allowed`);
    }

    const currentCount = config.variants.length;
    const newWeight = 1 / (currentCount + 1);

    // Rebalance all weights
    const variants = [
      ...config.variants.map(v => ({ ...v, weight: v.weight * (currentCount / (currentCount + 1)) })),
      { ...variant, weight: newWeight }
    ];

    return {
      ...config,
      variants,
      targetSampleSize: this.calculateSampleSize({
        minimumDetectableEffect: config.hypothesis.expectedEffectSize,
        variantsCount: variants.length
      })
    };
  }

  /**
   * Remove a variant from an experiment
   */
  removeVariant(config: ExperimentConfig, variantId: string): ExperimentConfig {
    const variants = config.variants.filter(v => v.id !== variantId);

    if (variants.length < 2) {
      throw new ConfigurationError('Cannot remove variant - minimum 2 variants required');
    }

    // Rebalance remaining weights
    const rebalancedVariants = variants.map(v => ({
      ...v,
      weight: v.weight / variants.reduce((sum, v) => sum + v.weight, 0)
    }));

    return {
      ...config,
      variants: rebalancedVariants,
      targetSampleSize: this.calculateSampleSize({
        minimumDetectableEffect: config.hypothesis.expectedEffectSize,
        variantsCount: variants.length
      })
    };
  }

  /**
   * Convert experiment to template
   */
  toTemplate(config: ExperimentConfig): Omit<ExperimentConfig, 'id' | 'startTime' | 'endTime'> {
    const { id, startTime, endTime, ...template } = config;
    return template;
  }

  /**
   * Create experiment from template
   */
  fromTemplate(
    template: Omit<ExperimentConfig, 'id' | 'startTime' | 'endTime'>,
    experimentId: ExperimentId,
    name: string
  ): ExperimentConfig {
    return {
      ...template,
      id: experimentId,
      name,
      startTime: undefined,
      endTime: undefined
    };
  }
}
