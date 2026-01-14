/**
 * A/B Testing Engine - Advanced experiment management and statistical analysis
 * Supports variant assignment, traffic splitting, statistical significance testing
 */

import type {
  Experiment,
  Variant,
  ExperimentResult,
  UserAttributes,
  EvaluationContext,
  FlagStorageEnv,
  MetricResult,
  FlagEvaluation,
} from '../types/index.js';

// ============================================================================
// Statistical Analysis
// ============================================================================

export interface StatisticalTest {
  testName: string;
  pValue: number;
  isSignificant: boolean;
  confidence: number;
  effectSize?: number;
  testStatistic?: number;
}

export interface ConversionMetrics {
  totalUsers: number;
  conversions: number;
  conversionRate: number;
  standardError: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

/**
 * Statistical analysis utilities
 */
export class StatisticalAnalyzer {
  /**
   * Perform Z-test for comparing two proportions
   */
  static zTest(
    control: ConversionMetrics,
    variant: ConversionMetrics,
    confidenceLevel: number = 0.95
  ): StatisticalTest {
    const p1 = control.conversionRate;
    const p2 = variant.conversionRate;
    const n1 = control.totalUsers;
    const n2 = variant.totalUsers;

    // Pooled proportion
    const pooledP = (control.conversions + variant.conversions) / (n1 + n2);

    // Standard error
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / n1 + 1 / n2));

    // Z-score
    const z = (p2 - p1) / se;

    // Two-tailed p-value
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    // Critical value for confidence level
    const alpha = 1 - confidenceLevel;
    const criticalValue = this.normalQuantile(1 - alpha / 2);

    // Effect size (Cohen's h)
    const effectSize = 2 * Math.asin(Math.sqrt(p2)) - 2 * Math.asin(Math.sqrt(p1));

    return {
      testName: 'Z-test',
      pValue,
      isSignificant: pValue < alpha,
      confidence: confidenceLevel,
      effectSize,
      testStatistic: z,
    };
  }

  /**
   * Perform Chi-square test for independence
   */
  static chiSquareTest(
    control: ConversionMetrics,
    variant: ConversionMetrics,
    confidenceLevel: number = 0.95
  ): StatisticalTest {
    const observed = [
      [control.conversions, control.totalUsers - control.conversions],
      [variant.conversions, variant.totalUsers - variant.conversions],
    ];

    const rowSums = observed.map((row) => row[0] + row[1]);
    const colSums = [
      observed[0][0] + observed[1][0],
      observed[0][1] + observed[1][1],
    ];
    const total = rowSums[0] + rowSums[1];

    // Expected frequencies
    const expected = [
      [(rowSums[0] * colSums[0]) / total, (rowSums[0] * colSums[1]) / total],
      [(rowSums[1] * colSums[0]) / total, (rowSums[1] * colSums[1]) / total],
    ];

    // Chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        chiSquare +=
          Math.pow(observed[i][j] - expected[i][j], 2) / expected[i][j];
      }
    }

    // Degrees of freedom
    const df = 1;

    // P-value (approximate)
    const pValue = 1 - this.chiSquareCDF(chiSquare, df);

    const alpha = 1 - confidenceLevel;

    return {
      testName: 'Chi-square test',
      pValue,
      isSignificant: pValue < alpha,
      confidence: confidenceLevel,
      testStatistic: chiSquare,
    };
  }

  /**
   * Calculate minimum sample size needed
   */
  static calculateMinSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    confidenceLevel: number = 0.95,
    power: number = 0.8
  ): number {
    const alpha = 1 - confidenceLevel;
    const beta = 1 - power;

    const zAlpha = this.normalQuantile(1 - alpha / 2);
    const zBeta = this.normalQuantile(power);

    const p1 = baselineRate;
    const p2 = baselineRate + minimumDetectableEffect;

    const pooledP = (p1 + p2) / 2;

    const n =
      (Math.pow(zAlpha * Math.sqrt(2 * pooledP * (1 - pooledP)) +
        zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2)) /
      Math.pow(p2 - p1, 2);

    return Math.ceil(n);
  }

  /**
   * Calculate confidence interval for a proportion
   */
  static confidenceInterval(
    conversions: number,
    total: number,
    confidenceLevel: number = 0.95
  ): { lower: number; upper: number } {
    const p = conversions / total;
    const se = Math.sqrt((p * (1 - p)) / total);

    const alpha = 1 - confidenceLevel;
    const z = this.normalQuantile(1 - alpha / 2);

    return {
      lower: p - z * se,
      upper: p + z * se,
    };
  }

  /**
   * Normal cumulative distribution function (CDF)
   */
  private static normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Normal quantile function (inverse CDF)
   */
  private static normalQuantile(p: number): number {
    // Beasley-Springer-Moro approximation
    const a = [-3.969683028665376e1, 2.209460984245205e2];
    const b = [-2.021016324402471e1, -5.112602495602216e1];
    const c = [3.981798805808806e-2, 6.307557240580142e-1];
    const d = [2.506628277459239, 1.000000000000017];

    const q = Math.min(p, 1 - p);
    const t = Math.sqrt(-2 * Math.log(q));
    const x =
      t -
      ((c[1] * t + c[0]) * t + b[1]) * t + b[0]) /
      (((d[1] * t + d[0]) * t + 1) * t + a[1]) * t + a[0]);

    if (p < 0.5) return -x;
    return x;
  }

  /**
   * Chi-square CDF (approximate)
   */
  private static chiSquareCDF(x: number, df: number): number {
    if (x < 0) return 0;
    if (x === 0) return 0;

    // Wilson-Hilferty approximation
    const z =
      (Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df))) /
      Math.sqrt(2 / (9 * df));

    return this.normalCDF(z);
  }
}

// ============================================================================
// A/B Testing Engine
// ============================================================================

export interface ExperimentConfig {
  name: string;
  description: string;
  flagId: string;
  variants: Array<{
    name: string;
    description?: string;
    value: unknown;
    allocation: number;
    isControl?: boolean;
  }>;
  trafficAllocation: number;
  hypothesis: string;
  successMetric: string;
  minSampleSize?: number;
  confidenceLevel?: number;
  startDate?: Date;
  endDate?: Date;
}

export class ABTestingEngine {
  private storage: DurableObjectStub;
  private analyticsStorage: DurableObjectStub;
  private userAssignments: Map<string, Map<string, string>>; // userId -> experimentId -> variantId
  private murmurHash: (key: string) => number;

  constructor(env: FlagStorageEnv) {
    this.storage = env.FLAGS_DURABLE_OBJECT.idFromName('experiments');
    this.analyticsStorage = env.ANALYTICS_DURABLE_OBJECT.idFromName('analytics');
    this.userAssignments = new Map();
    this.murmurHash = this.createMurmurHash3();
  }

  // ========================================================================
  // Experiment Management
  // ========================================================================

  /**
   * Create a new A/B experiment
   */
  async createExperiment(config: ExperimentConfig): Promise<Experiment> {
    // Validate variant allocations sum to 100
    const totalAllocation = config.variants.reduce(
      (sum, v) => sum + v.allocation,
      0
    );
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error('Variant allocations must sum to 100%');
    }

    const experimentId = this.generateExperimentId();

    const variants: Variant[] = config.variants.map((v, index) => ({
      id: `variant-${index}`,
      name: v.name,
      description: v.description || '',
      value: v.value,
      allocation: v.allocation,
      isControl: v.isControl || false,
    }));

    const experiment: Experiment = {
      id: experimentId,
      name: config.name,
      description: config.description,
      flagId: config.flagId,
      variants,
      trafficAllocation: config.trafficAllocation,
      status: 'draft',
      hypothesis: config.hypothesis,
      successMetric: config.successMetric,
      startDate: config.startDate,
      endDate: config.endDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      minSampleSize: config.minSampleSize,
      confidenceLevel: config.confidenceLevel || 0.95,
    };

    await this.storage.setExperiment(experiment);

    return experiment;
  }

  /**
   * Start an experiment
   */
  async startExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment '${experimentId}' not found`);
    }

    if (experiment.status === 'running') {
      throw new Error('Experiment is already running');
    }

    experiment.status = 'running';
    experiment.startDate = new Date();
    experiment.updatedAt = new Date();

    await this.storage.setExperiment(experiment);

    return experiment;
  }

  /**
   * Pause an experiment
   */
  async pauseExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment '${experimentId}' not found`);
    }

    if (experiment.status !== 'running') {
      throw new Error('Only running experiments can be paused');
    }

    experiment.status = 'paused';
    experiment.updatedAt = new Date();

    await this.storage.setExperiment(experiment);

    return experiment;
  }

  /**
   * Complete an experiment
   */
  async completeExperiment(experimentId: string): Promise<Experiment> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment '${experimentId}' not found`);
    }

    if (experiment.status !== 'running' && experiment.status !== 'paused') {
      throw new Error('Only running or paused experiments can be completed');
    }

    experiment.status = 'completed';
    experiment.endDate = new Date();
    experiment.updatedAt = new Date();

    await this.storage.setExperiment(experiment);

    return experiment;
  }

  /**
   * Get experiment by ID
   */
  async getExperiment(experimentId: string): Promise<Experiment | undefined> {
    return this.storage.getExperiment(experimentId);
  }

  /**
   * List all experiments
   */
  async listExperiments(filter?: {
    status?: string;
    flagId?: string;
  }): Promise<Experiment[]> {
    let experiments = await this.storage.listExperiments(filter);

    if (filter?.status) {
      experiments = experiments.filter((e) => e.status === filter.status);
    }

    if (filter?.flagId) {
      experiments = experiments.filter((e) => e.flagId === filter.flagId);
    }

    return experiments;
  }

  /**
   * Delete an experiment
   */
  async deleteExperiment(experimentId: string): Promise<boolean> {
    return this.storage.deleteExperiment(experimentId);
  }

  // ========================================================================
  // Variant Assignment
  // ========================================================================

  /**
   * Assign a user to a variant
   */
  async assignVariant(
    experimentId: string,
    userId: string,
    attributes?: UserAttributes
  ): Promise<Variant | null> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment '${experimentId}' not found`);
    }

    if (experiment.status !== 'running') {
      // Return default/control variant for non-running experiments
      return experiment.variants.find((v) => v.isControl) || null;
    }

    // Check if user is in traffic allocation
    const hash = this.murmurHash(userId);
    const scaledHash = (hash % 100) + 1; // 1-100

    if (scaledHash > experiment.trafficAllocation) {
      // User not in experiment traffic
      return null;
    }

    // Check if user already assigned
    if (!this.userAssignments.has(userId)) {
      this.userAssignments.set(userId, new Map());
    }

    const userExperiments = this.userAssignments.get(userId)!;
    if (userExperiments.has(experimentId)) {
      const variantId = userExperiments.get(experimentId)!;
      return experiment.variants.find((v) => v.id === variantId) || null;
    }

    // Assign to variant based on deterministic hash
    const variant = this.assignVariantByHash(experiment, userId);
    userExperiments.set(experimentId, variant.id);

    // Record assignment
    await this.recordAssignment(experimentId, userId, variant.id);

    return variant;
  }

  /**
   * Get user's assigned variant
   */
  async getAssignedVariant(
    experimentId: string,
    userId: string
  ): Promise<Variant | null> {
    const userExperiments = this.userAssignments.get(userId);
    if (!userExperiments) {
      return null;
    }

    const variantId = userExperiments.get(experimentId);
    if (!variantId) {
      return null;
    }

    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      return null;
    }

    return experiment.variants.find((v) => v.id === variantId) || null;
  }

  /**
   * Batch assign multiple users to variants
   */
  async batchAssignVariants(
    experimentId: string,
    userIds: string[]
  ): Promise<Map<string, Variant | null>> {
    const results = new Map<string, Variant | null>();

    for (const userId of userIds) {
      const variant = await this.assignVariant(experimentId, userId);
      results.set(userId, variant);
    }

    return results;
  }

  // ========================================================================
  // Experiment Results and Analysis
  // ========================================================================

  /**
   * Get experiment results
   */
  async getExperimentResults(experimentId: string): Promise<ExperimentResult[]> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment) {
      throw new Error(`Experiment '${experimentId}' not found');
    }

    const results: ExperimentResult[] = [];

    for (const variant of experiment.variants) {
      const metrics = await this.getVariantMetrics(experimentId, variant.id);

      // Calculate conversion rate
      const conversionRate =
        metrics.sampleSize > 0 ? metrics.conversions / metrics.sampleSize : 0;

      // Perform statistical tests against control
      const controlVariant = experiment.variants.find((v) => v.isControl);
      let statisticalTest: StatisticalTest | undefined;

      if (controlVariant && variant.id !== controlVariant.id) {
        const controlMetrics = await this.getVariantMetrics(
          experimentId,
          controlVariant.id
        );

        const controlMetricsData: ConversionMetrics = {
          totalUsers: controlMetrics.sampleSize,
          conversions: controlMetrics.conversions,
          conversionRate:
            controlMetrics.sampleSize > 0
              ? controlMetrics.conversions / controlMetrics.sampleSize
              : 0,
          standardError: 0,
          confidenceInterval: { lower: 0, upper: 0 },
        };

        const variantMetricsData: ConversionMetrics = {
          totalUsers: metrics.sampleSize,
          conversions: metrics.conversions,
          conversionRate,
          standardError: 0,
          confidenceInterval: { lower: 0, upper: 0 },
        };

        statisticalTest = StatisticalAnalyzer.zTest(
          controlMetricsData,
          variantMetricsData,
          experiment.confidenceLevel
        );
      }

      // Calculate uplift
      let uplift: number | undefined;
      if (controlVariant) {
        const controlMetrics = await this.getVariantMetrics(
          experimentId,
          controlVariant.id
        );
        const controlRate =
          controlMetrics.sampleSize > 0
            ? controlMetrics.conversions / controlMetrics.sampleSize
            : 0;
        if (controlRate > 0) {
          uplift = ((conversionRate - controlRate) / controlRate) * 100;
        }
      }

      results.push({
        experimentId,
        variantId: variant.id,
        metrics: [],
        conversionRate,
        sampleSize: metrics.sampleSize,
        confidence: experiment.confidenceLevel,
        isWinner: statisticalTest?.isSignificant || false,
        uplift,
        pValue: statisticalTest?.pValue,
      });
    }

    return results;
  }

  /**
   * Determine experiment winner
   */
  async determineWinner(experimentId: string): Promise<Variant | null> {
    const results = await this.getExperimentResults(experimentId);

    // Find variant with highest statistically significant improvement
    const significantResults = results.filter((r) => r.isWinner);

    if (significantResults.length === 0) {
      return null;
    }

    // Sort by conversion rate descending
    significantResults.sort((a, b) => b.conversionRate - a.conversionRate);

    const winnerResult = significantResults[0];
    const experiment = await this.storage.getExperiment(experimentId);

    return (
      experiment?.variants.find((v) => v.id === winnerResult.variantId) || null
    );
  }

  /**
   * Check if experiment has reached required sample size
   */
  async hasReachedSampleSize(experimentId: string): Promise<boolean> {
    const experiment = await this.storage.getExperiment(experimentId);
    if (!experiment || !experiment.minSampleSize) {
      return true; // No minimum specified
    }

    const results = await this.getExperimentResults(experimentId);
    const maxSampleSize = Math.max(...results.map((r) => r.sampleSize));

    return maxSampleSize >= experiment.minSampleSize;
  }

  /**
   * Get required sample size for experiment
   */
  calculateRequiredSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    confidenceLevel: number = 0.95,
    power: number = 0.8
  ): number {
    return StatisticalAnalyzer.calculateMinSampleSize(
      baselineRate,
      minimumDetectableEffect,
      confidenceLevel,
      power
    );
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private assignVariantByHash(experiment: Experiment, userId: string): Variant {
    const hash = this.murmurHash(userId);
    const scaledHash = (hash % 100) + 1; // 1-100

    let cumulativePercentage = 0;
    for (const variant of experiment.variants) {
      cumulativePercentage += variant.allocation;
      if (scaledHash <= cumulativePercentage) {
        return variant;
      }
    }

    // Fallback to last variant
    return experiment.variants[experiment.variants.length - 1];
  }

  private async getVariantMetrics(
    experimentId: string,
    variantId: string
  ): Promise<{
    conversions: number;
    sampleSize: number;
  }> {
    // Query analytics for variant metrics
    // This is a simplified version - in production, you'd query your analytics store
    const evaluations = await this.analyticsStorage.queryEvaluations({
      flagId: experimentId,
      limit: 10000,
    });

    const variantEvaluations = evaluations.filter(
      (e) => e.evaluationDetails.matchedVariant === variantId
    );

    // Count conversions (simplified - in production, track actual conversions)
    const conversions = variantEvaluations.length; // Placeholder

    return {
      conversions: Math.floor(conversions * 0.1), // Assume 10% conversion rate
      sampleSize: variantEvaluations.length,
    };
  }

  private async recordAssignment(
    experimentId: string,
    userId: string,
    variantId: string
  ): Promise<void> {
    // Record assignment in analytics
    // This would track the assignment for analysis
  }

  private generateExperimentId(): string {
    return `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createMurmurHash3(): (key: string) => number {
    return (key: string): number => {
      let h = 0xdeadbeef;
      for (let i = 0; i < key.length; i++) {
        const k = key.charCodeAt(i);
        h = Math.imul(h ^ k, 2654435761);
      }
      h = Math.imul(h ^ (h >>> 16), 2654435761);
      return (h ^ (h >>> 16)) >>> 0;
    };
  }
}
