/**
 * A/B Testing Framework
 *
 * Provides comprehensive A/B testing capabilities with experiment
 * management, variant assignment, and metrics tracking.
 */

import type {
  Experiment,
  ExperimentVariant,
  EvaluationContext,
  AssignmentResult,
  EvaluationResult,
} from './types';
import { ExperimentSchema } from './validation';

/**
 * A/B testing manager class
 */
export class ABTestingManager {
  private experiments: Map<string, Experiment> = new Map();
  private assignments: Map<string, Map<string, string>> = new Map(); // userId -> experiment -> variant

  /**
   * Create a new A/B testing manager
   */
  constructor(initialExperiments: Experiment[] = []) {
    for (const experiment of initialExperiments) {
      this.setExperiment(experiment);
    }
  }

  /**
   * Set an experiment
   */
  setExperiment(experiment: Experiment): void {
    const validated = ExperimentSchema.parse(experiment) as Experiment;
    this.experiments.set(validated.name, validated);
  }

  /**
   * Get an experiment
   */
  getExperiment(name: string): Experiment | undefined {
    return this.experiments.get(name);
  }

  /**
   * Get all experiments
   */
  getAllExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Delete an experiment
   */
  deleteExperiment(name: string): boolean {
    // Clean up assignments
    const assignmentsArray = Array.from(this.assignments.entries());
    for (const [userId, userAssignments] of assignmentsArray) {
      userAssignments.delete(name);
      if (userAssignments.size === 0) {
        this.assignments.delete(userId);
      }
    }

    return this.experiments.delete(name);
  }

  /**
   * Assign a user to a variant
   */
  assignVariant(
    experimentName: string,
    context: EvaluationContext = {}
  ): AssignmentResult | null {
    const experiment = this.experiments.get(experimentName);

    if (!experiment) {
      return null;
    }

    // Check if experiment is enabled
    if (!experiment.enabled) {
      return null;
    }

    // Check if experiment has expired
    if (experiment.endsAt && Date.now() > experiment.endsAt) {
      return null;
    }

    // Check if experiment has started
    if (experiment.startedAt && Date.now() < experiment.startedAt) {
      return null;
    }

    // Evaluate targeting rules (reuse feature flag logic)
    const targetingResult = this.evaluateTargeting(experiment, context);
    if (!targetingResult.enabled) {
      return null;
    }

    // Get or create user assignments
    const userId = context.userId || 'anonymous';
    let userAssignments = this.assignments.get(userId);
    if (!userAssignments) {
      userAssignments = new Map();
      this.assignments.set(userId, userAssignments);
    }

    // Check if user already has an assignment
    const existingVariant = userAssignments.get(experimentName);
    if (existingVariant) {
      const variant = experiment.variants.find((v) => v.name === existingVariant);
      if (variant) {
        return {
          experiment: experimentName,
          variant: existingVariant,
          config: variant.config,
          consistent: true,
          timestamp: Date.now(),
        };
      }
    }

    // Assign new variant
    const variant = this.selectVariant(experiment, userId);
    userAssignments.set(experimentName, variant.name);

    // Increment sample size
    if (experiment.currentSampleSize !== undefined) {
      experiment.currentSampleSize++;
    }

    return {
      experiment: experimentName,
      variant: variant.name,
      config: variant.config,
      consistent: false,
      timestamp: Date.now(),
    };
  }

  /**
   * Get user's current assignment
   */
  getAssignment(
    experimentName: string,
    userId: string
  ): AssignmentResult | null {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      return null;
    }

    const userAssignments = this.assignments.get(userId);
    if (!userAssignments) {
      return null;
    }

    const variantName = userAssignments.get(experimentName);
    if (!variantName) {
      return null;
    }

    const variant = experiment.variants.find((v) => v.name === variantName);
    if (!variant) {
      return null;
    }

    return {
      experiment: experimentName,
      variant: variantName,
      config: variant.config,
      consistent: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all assignments for a user
   */
  getUserAssignments(userId: string): Map<string, AssignmentResult> {
    const userAssignments = this.assignments.get(userId);
    if (!userAssignments) {
      return new Map();
    }

    const result = new Map<string, AssignmentResult>();

    const assignmentsArray = Array.from(userAssignments.entries());
    for (const [experimentName, variantName] of assignmentsArray) {
      const experiment = this.experiments.get(experimentName);
      if (experiment) {
        const variant = experiment.variants.find((v) => v.name === variantName);
        if (variant) {
          result.set(experimentName, {
            experiment: experimentName,
            variant: variantName,
            config: variant.config,
            consistent: true,
            timestamp: Date.now(),
          });
        }
      }
    }

    return result;
  }

  /**
   * Record metric for an experiment
   */
  recordMetric(
    experimentName: string,
    variantName: string,
    metricName: string,
    value: number
  ): boolean {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      return false;
    }

    // Check if metric is tracked
    if (!experiment.metrics.includes(metricName)) {
      return false;
    }

    // Store metric (in production, this would go to a metrics store)
    // For now, we'll just acknowledge it
    console.debug(
      `[ABTesting] Metric recorded: ${experimentName}/${variantName}/${metricName} = ${value}`
    );

    return true;
  }

  /**
   * Get experiment statistics
   */
  getExperimentStats(experimentName: string): {
    totalAssignments: number;
    variantDistribution: Map<string, number>;
    sampleSizeReached: boolean;
  } | null {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      return null;
    }

    // Count assignments per variant
    const variantDistribution = new Map<string, number>();
    let totalAssignments = 0;

    const assignmentsArray = Array.from(this.assignments.values());
    for (const userAssignments of assignmentsArray) {
      const variant = userAssignments.get(experimentName);
      if (variant) {
        variantDistribution.set(variant, (variantDistribution.get(variant) || 0) + 1);
        totalAssignments++;
      }
    }

    // Check if sample size is reached
    const sampleSizeReached =
      experiment.requiredSampleSize === undefined ||
      experiment.currentSampleSize === undefined ||
      experiment.currentSampleSize >= experiment.requiredSampleSize;

    return {
      totalAssignments,
      variantDistribution,
      sampleSizeReached,
    };
  }

  /**
   * Evaluate targeting rules
   */
  private evaluateTargeting(
    experiment: Experiment,
    context: EvaluationContext
  ): EvaluationResult {
    // Check tier targeting
    if (experiment.targeting.tier !== 'all') {
      if (context.tier && context.tier !== experiment.targeting.tier) {
        return {
          enabled: false,
          reason: `User tier "${context.tier}" does not match required tier "${experiment.targeting.tier}"`,
        };
      }
    }

    // Check explicit user targeting
    if (experiment.targeting.users.length > 0 && context.userId) {
      if (!experiment.targeting.users.includes(context.userId)) {
        return {
          enabled: false,
          reason: `User "${context.userId}" is not in target list`,
        };
      }
    }

    // Check organization targeting
    if (experiment.targeting.organizations.length > 0 && context.organizationId) {
      if (!experiment.targeting.organizations.includes(context.organizationId)) {
        return {
          enabled: false,
          reason: `Organization "${context.organizationId}" is not in target list`,
        };
      }
    }

    // Check percentage rollout
    if (experiment.targeting.percentage > 0) {
      const bucket = this.getBucketForUser(experiment.name, context.userId || 'anonymous');
      if (bucket >= experiment.targeting.percentage) {
        return {
          enabled: false,
          reason: `User is not in ${experiment.targeting.percentage}% rollout`,
        };
      }
    }

    return {
      enabled: true,
      reason: 'User matches all targeting criteria',
    };
  }

  /**
   * Select a variant based on weights
   */
  private selectVariant(experiment: Experiment, userId: string): ExperimentVariant {
    // Use deterministic selection based on user ID
    const hash = this.hashString(`${experiment.name}:${userId}`);
    const normalized = hash / 0xffffffff; // Normalize to 0-1

    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (normalized < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant (shouldn't happen if weights sum to 1)
    return experiment.variants[0];
  }

  /**
   * Get consistent bucket for a user (0-99)
   */
  private getBucketForUser(experimentName: string, userId: string): number {
    const input = `${experimentName}:${userId}`;

    // Simple hash algorithm (djb2)
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
    }

    return Math.abs(hash) % 100;
  }

  /**
   * Hash a string to a number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
  }

  /**
   * Update an experiment
   */
  updateExperiment(name: string, updates: Partial<Experiment>): Experiment | null {
    const existing = this.experiments.get(name);
    if (!existing) {
      return null;
    }

    const updated: Experiment = {
      ...existing,
      ...updates,
      name, // Ensure name doesn't change
      updatedAt: Date.now(),
    };

    this.setExperiment(updated);
    return updated;
  }

  /**
   * Enable/disable an experiment
   */
  setExperimentEnabled(name: string, enabled: boolean): boolean {
    const experiment = this.experiments.get(name);
    if (!experiment) {
      return false;
    }

    experiment.enabled = enabled;
    experiment.updatedAt = Date.now();

    if (enabled && !experiment.startedAt) {
      experiment.startedAt = Date.now();
    }

    return true;
  }

  /**
   * Add variant to experiment
   */
  addVariant(experimentName: string, variant: ExperimentVariant): boolean {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      return false;
    }

    experiment.variants.push(variant);
    experiment.updatedAt = Date.now();
    return true;
  }

  /**
   * Remove variant from experiment
   */
  removeVariant(experimentName: string, variantName: string): boolean {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      return false;
    }

    if (experiment.variants.length <= 1) {
      throw new Error('Cannot remove last variant from experiment');
    }

    const index = experiment.variants.findIndex((v) => v.name === variantName);
    if (index > -1) {
      experiment.variants.splice(index, 1);
      experiment.updatedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Get statistics about experiments
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
    completed: number;
    totalAssignments: number;
  } {
    const experiments = Array.from(this.experiments.values());
    const now = Date.now();

    let totalAssignments = 0;
    const assignmentsArray = Array.from(this.assignments.values());
    for (const userAssignments of assignmentsArray) {
      totalAssignments += userAssignments.size;
    }

    return {
      total: experiments.length,
      enabled: experiments.filter((e) => e.enabled).length,
      disabled: experiments.filter((e) => !e.enabled).length,
      completed: experiments.filter((e) => e.endsAt && e.endsAt < now).length,
      totalAssignments,
    };
  }

  /**
   * Export all experiments
   */
  export(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Import experiments
   */
  import(experiments: Experiment[]): void {
    this.experiments.clear();
    this.assignments.clear();
    for (const experiment of experiments) {
      this.setExperiment(experiment);
    }
  }
}

/**
 * Helper function to create an experiment
 */
export function createExperiment(
  name: string,
  variants: ExperimentVariant[],
  metrics: string[],
  options?: Partial<Experiment>
): Experiment {
  const now = Date.now();

  // Normalize variant weights
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const normalizedVariants = variants.map((v) => ({
    ...v,
    weight: v.weight / totalWeight,
  }));

  return {
    name,
    enabled: false,
    variants: normalizedVariants,
    targeting: {
      users: [],
      percentage: 100,
      organizations: [],
      tier: 'all',
    },
    metrics,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...options,
  };
}

/**
 * Helper function to create A/B test (control vs treatment)
 */
export function createABTest(
  name: string,
  controlConfig: Record<string, unknown>,
  treatmentConfig: Record<string, unknown>,
  metrics: string[],
  options?: Partial<Experiment>
): Experiment {
  return createExperiment(
    name,
    [
      { name: 'control', weight: 0.5, config: controlConfig },
      { name: 'treatment', weight: 0.5, config: treatmentConfig },
    ],
    metrics,
    options
  );
}

/**
 * Helper function to create multi-variant test
 */
export function createMultiVariantTest(
  name: string,
  variants: { name: string; config: Record<string, unknown> }[],
  metrics: string[],
  options?: Partial<Experiment>
): Experiment {
  const weight = 1 / variants.length;
  const experimentVariants: ExperimentVariant[] = variants.map((v) => ({
    ...v,
    weight,
  }));

  return createExperiment(name, experimentVariants, metrics, options);
}
