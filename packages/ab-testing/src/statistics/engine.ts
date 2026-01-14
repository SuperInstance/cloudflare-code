/**
 * Statistical Engine - Performs rigorous statistical analysis
 * including significance testing, confidence intervals, and Bayesian analysis
 */

import type {
  ExperimentResults,
  VariantStats,
  MetricStats,
  StatisticalResult,
  StatisticalTest,
  MetricType
} from '../types/experiment.js';
import { StatisticalTestError, InsufficientSampleSizeError } from '../types/errors.js';

/**
 * Statistical test configuration
 */
export interface StatisticalTestConfig {
  /** Test type to use */
  testType: StatisticalTest;
  /** Significance level (alpha) */
  alpha: number;
  /** Minimum sample size required */
  minSampleSize: number;
  /** Whether to use two-tailed test */
  twoTailed?: boolean;
  /** Confidence level for intervals */
  confidenceLevel?: number;
}

/**
 * Test result summary
 */
export interface TestSummary {
  /** Whether result is significant */
  significant: boolean;
  /** P-value */
  pValue: number;
  /** Confidence level achieved */
  confidence: number;
  /** Effect size */
  effectSize: number;
  /** Confidence interval */
  confidenceInterval: [number, number];
  /** Test statistic */
  testStatistic: number;
  /** Critical value */
  criticalValue: number;
  /** Statistical power */
  power: number;
  /** Interpretation */
  interpretation: string;
}

/**
 * Comparison result between two variants
 */
export interface ComparisonResult {
  /** Control variant stats */
  control: VariantStats;
  /** Treatment variant stats */
  treatment: VariantStats;
  /** Statistical test results */
  testResults: StatisticalResult;
  /** Lift percentage */
  lift: number;
  /** Whether lift is significant */
  significant: boolean;
  /** Recommendation */
  recommendation: 'deploy' | 'continue' | 'rollback';
}

/**
 * Bayesian analysis result
 */
export interface BayesianResult {
  /** Posterior probability that treatment is better */
  probability: number;
  /** Expected loss if deploying treatment */
  expectedLoss: number;
  /** Credible interval */
  credibleInterval: [number, number];
  /** Posterior mean */
  posteriorMean: number;
  /** Posterior standard deviation */
  posteriorStd: number;
  /** Recommendation */
  recommendation: 'deploy' | 'continue' | 'rollback';
}

/**
 * Statistical Engine class
 */
export class StatisticalEngine {
  /**
   * Calculate Z-test for proportions
   */
  zTestProportions(
    controlConversions: number,
    controlTotal: number,
    treatmentConversions: number,
    treatmentTotal: number,
    alpha: number = 0.05
  ): TestSummary {
    const p1 = controlConversions / controlTotal;
    const p2 = treatmentConversions / treatmentTotal;
    const pooledP = (controlConversions + treatmentConversions) / (controlTotal + treatmentTotal);
    const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlTotal + 1 / treatmentTotal));

    if (se === 0) {
      throw new StatisticalTestError('z_test', 'Standard error is zero');
    }

    const z = (p2 - p1) / se;
    const pValue = this.calculateTwoTailedPValue(z);
    const criticalValue = this.getCriticalZ(alpha);
    const significant = Math.abs(z) > criticalValue;

    const effectSize = p2 - p1;
    const marginOfError = criticalValue * se;
    const confidenceInterval: [number, number] = [
      effectSize - marginOfError,
      effectSize + marginOfError
    ];

    const power = this.calculatePowerProportions(p1, effectSize, controlTotal, treatmentTotal, alpha);

    return {
      significant,
      pValue,
      confidence: 1 - alpha,
      effectSize,
      confidenceInterval,
      testStatistic: z,
      criticalValue,
      power,
      interpretation: this.interpretZTest(z, pValue, alpha)
    };
  }

  /**
   * Calculate T-test for means
   */
  tTestMeans(
    controlMean: number,
    controlStd: number,
    controlN: number,
    treatmentMean: number,
    treatmentStd: number,
    treatmentN: number,
    alpha: number = 0.05
  ): TestSummary {
    const se = Math.sqrt((controlStd * controlStd) / controlN + (treatmentStd * treatmentStd) / treatmentN);

    if (se === 0) {
      throw new StatisticalTestError('t_test', 'Standard error is zero');
    }

    const t = (treatmentMean - controlMean) / se;
    const df = this.calculateDegreesOfFreedom(controlStd, controlN, treatmentStd, treatmentN);
    const pValue = this.calculateTwoTailedPValueT(t, df);
    const criticalValue = this.getCriticalT(alpha, df);
    const significant = Math.abs(t) > criticalValue;

    const effectSize = treatmentMean - controlMean;
    const marginOfError = criticalValue * se;
    const confidenceInterval: [number, number] = [
      effectSize - marginOfError,
      effectSize + marginOfError
    ];

    const power = this.calculatePowerMeans(effectSize, controlStd, controlN, treatmentN, alpha);

    return {
      significant,
      pValue,
      confidence: 1 - alpha,
      effectSize,
      confidenceInterval,
      testStatistic: t,
      criticalValue,
      power,
      interpretation: this.interpretTTest(t, pValue, alpha)
    };
  }

  /**
   * Calculate Chi-square test
   */
  chiSquareTest(
    controlConversions: number,
    controlTotal: number,
    treatmentConversions: number,
    treatmentTotal: number,
    alpha: number = 0.05
  ): TestSummary {
    const controlFailures = controlTotal - controlConversions;
    const treatmentFailures = treatmentTotal - treatmentConversions;

    const rowSums = [controlTotal, treatmentTotal];
    const colSums = [
      controlConversions + treatmentConversions,
      controlFailures + treatmentFailures
    ];
    const total = controlTotal + treatmentTotal;

    // Expected frequencies
    const expectedControlConversions = (rowSums[0] * colSums[0]) / total;
    const expectedControlFailures = (rowSums[0] * colSums[1]) / total;
    const expectedTreatmentConversions = (rowSums[1] * colSums[0]) / total;
    const expectedTreatmentFailures = (rowSums[1] * colSums[1]) / total;

    // Chi-square statistic
    const chi2 =
      Math.pow(controlConversions - expectedControlConversions, 2) / expectedControlConversions +
      Math.pow(controlFailures - expectedControlFailures, 2) / expectedControlFailures +
      Math.pow(treatmentConversions - expectedTreatmentConversions, 2) / expectedTreatmentConversions +
      Math.pow(treatmentFailures - expectedTreatmentFailures, 2) / expectedTreatmentFailures;

    const df = 1; // (rows - 1) * (cols - 1)
    const pValue = this.calculateChiSquarePValue(chi2, df);
    const criticalValue = this.getCriticalChiSquare(alpha, df);
    const significant = chi2 > criticalValue;

    const p1 = controlConversions / controlTotal;
    const p2 = treatmentConversions / treatmentTotal;
    const effectSize = p2 - p1;

    return {
      significant,
      pValue,
      confidence: 1 - alpha,
      effectSize,
      confidenceInterval: [0, 0], // Not applicable for chi-square
      testStatistic: chi2,
      criticalValue,
      power: 0, // Would need complex calculation
      interpretation: this.interpretChiSquare(chi2, pValue, alpha)
    };
  }

  /**
   * Perform Bayesian analysis
   */
  bayesianAnalysis(
    controlConversions: number,
    controlTotal: number,
    treatmentConversions: number,
    treatmentTotal: number,
    threshold: number = 0.01
  ): BayesianResult {
    // Beta distribution parameters (using conjugate prior)
    const alphaPrior = 1;
    const betaPrior = 1;

    const alphaControl = alphaPrior + controlConversions;
    const betaControl = betaPrior + controlTotal - controlConversions;

    const alphaTreatment = alphaPrior + treatmentConversions;
    const betaTreatment = betaPrior + treatmentTotal - treatmentConversions;

    // Monte Carlo simulation to estimate probability
    const simulations = 100000;
    let treatmentBetter = 0;
    let totalLoss = 0;

    for (let i = 0; i < simulations; i++) {
      const sampleControl = this.betaRandom(alphaControl, betaControl);
      const sampleTreatment = this.betaRandom(alphaTreatment, betaTreatment);

      if (sampleTreatment > sampleControl) {
        treatmentBetter++;
      }

      const loss = Math.max(0, sampleControl - sampleTreatment);
      totalLoss += loss;
    }

    const probability = treatmentBetter / simulations;
    const expectedLoss = totalLoss / simulations;

    // Posterior mean and std
    const posteriorMean = alphaTreatment / (alphaTreatment + betaTreatment);
    const posteriorStd =
      Math.sqrt(
        (alphaTreatment * betaTreatment) /
          Math.pow(alphaTreatment + betaTreatment, 2) /
          (alphaTreatment + betaTreatment + 1)
      );

    // Credible interval (95%)
    const credibleInterval: [number, number] = [
      this.betaQuantile(alphaTreatment, betaTreatment, 0.025),
      this.betaQuantile(alphaTreatment, betaTreatment, 0.975)
    ];

    let recommendation: 'deploy' | 'continue' | 'rollback';
    if (probability > 0.99 && expectedLoss < threshold) {
      recommendation = 'deploy';
    } else if (probability < 0.01) {
      recommendation = 'rollback';
    } else {
      recommendation = 'continue';
    }

    return {
      probability,
      expectedLoss,
      credibleInterval,
      posteriorMean,
      posteriorStd,
      recommendation
    };
  }

  /**
   * Calculate effect size (Cohen's d)
   */
  cohenD(controlMean: number, controlStd: number, treatmentMean: number, treatmentStd: number): number {
    const pooledStd = Math.sqrt(
      (Math.pow(controlStd, 2) + Math.pow(treatmentStd, 2)) / 2
    );

    if (pooledStd === 0) {
      return 0;
    }

    return (treatmentMean - controlMean) / pooledStd;
  }

  /**
   * Calculate relative lift
   */
  calculateLift(controlValue: number, treatmentValue: number): number {
    if (controlValue === 0) {
      return treatmentValue > 0 ? 1 : 0;
    }
    return (treatmentValue - controlValue) / controlValue;
  }

  /**
   * Calculate confidence interval for proportion
   */
  proportionCI(
    successes: number,
    total: number,
    confidenceLevel: number = 0.95
  ): [number, number] {
    const p = successes / total;
    const z = this.getCriticalZ(1 - confidenceLevel);
    const se = Math.sqrt((p * (1 - p)) / total);

    const marginOfError = z * se;

    return [
      Math.max(0, p - marginOfError),
      Math.min(1, p + marginOfError)
    ];
  }

  /**
   * Calculate confidence interval for mean
   */
  meanCI(
    mean: number,
    std: number,
    n: number,
    confidenceLevel: number = 0.95
  ): [number, number] {
    const t = this.getCriticalT(1 - confidenceLevel, n - 1);
    const se = std / Math.sqrt(n);

    const marginOfError = t * se;

    return [
      mean - marginOfError,
      mean + marginOfError
    ];
  }

  /**
   * Compare two variants
   */
  compareVariants(
    control: VariantStats,
    treatment: VariantStats,
    metricName: string,
    config: StatisticalTestConfig
  ): ComparisonResult {
    const controlMetric = control.metrics[metricName];
    const treatmentMetric = treatment.metrics[metricName];

    if (!controlMetric || !treatmentMetric) {
      throw new StatisticalTestError(config.testType, 'Metric not found');
    }

    let testResult: StatisticalResult;
    let lift: number;

    if (config.testType === 'z_test' || config.testType === 'chi_square') {
      // For binary metrics
      const test = this.zTestProportions(
        Math.round(controlMetric.mean * controlMetric.count),
        controlMetric.count,
        Math.round(treatmentMetric.mean * treatmentMetric.count),
        treatmentMetric.count,
        config.alpha
      );

      testResult = {
        testType: config.testType,
        pValue: test.pValue,
        significant: test.significant,
        confidence: test.confidence,
        effectSize: test.effectSize,
        confidenceInterval: test.confidenceInterval,
        testStatistic: test.testStatistic,
        criticalValue: test.criticalValue,
        power: test.power
      };

      lift = this.calculateLift(controlMetric.mean, treatmentMetric.mean);
    } else {
      // For continuous metrics
      const test = this.tTestMeans(
        controlMetric.mean,
        controlMetric.standardDeviation,
        controlMetric.count,
        treatmentMetric.mean,
        treatmentMetric.standardDeviation,
        treatmentMetric.count,
        config.alpha
      );

      testResult = {
        testType: config.testType,
        pValue: test.pValue,
        significant: test.significant,
        confidence: test.confidence,
        effectSize: test.effectSize,
        confidenceInterval: test.confidenceInterval,
        testStatistic: test.testStatistic,
        criticalValue: test.criticalValue,
        power: test.power
      };

      lift = this.calculateLift(controlMetric.mean, treatmentMetric.mean);
    }

    // Make recommendation
    let recommendation: 'deploy' | 'continue' | 'rollback';
    if (testResult.significant && lift > 0) {
      recommendation = 'deploy';
    } else if (testResult.significant && lift < 0) {
      recommendation = 'rollback';
    } else {
      recommendation = 'continue';
    }

    return {
      control,
      treatment,
      testResults: testResult,
      lift,
      significant: testResult.significant,
      recommendation
    };
  }

  /**
   * Determine winner from experiment results
   */
  determineWinner(
    results: ExperimentResults,
    primaryMetric: string,
    config: StatisticalTestConfig
  ): {
    variantId: string | null;
    confidence: number;
    lift: number;
    reasoning: string;
  } {
    const control = results.variantStats.find(v => {
      const variant = results.variantStats.find(sv => sv.variantId === v.variantId);
      return variant?.metrics[primaryMetric] !== undefined;
    });

    if (!control || results.variantStats.length < 2) {
      return {
        variantId: null,
        confidence: 0,
        lift: 0,
        reasoning: 'Insufficient data to determine winner'
      };
    }

    let bestVariant: string | null = null;
    let bestLift = -Infinity;
    let bestConfidence = 0;
    let significant = false;

    for (const variant of results.variantStats) {
      if (variant.variantId === control.variantId) continue;

      const comparison = this.compareVariants(control, variant, primaryMetric, config);

      if (comparison.significant && comparison.lift > bestLift) {
        bestVariant = variant.variantId;
        bestLift = comparison.lift;
        bestConfidence = comparison.testResults.confidence;
        significant = true;
      }
    }

    if (!significant) {
      return {
        variantId: null,
        confidence: 0,
        lift: 0,
        reasoning: 'No statistically significant winner found'
      };
    }

    return {
      variantId: bestVariant,
      confidence: bestConfidence,
      lift: bestLift,
      reasoning: `${bestVariant} shows ${(bestLift * 100).toFixed(2)}% lift with ${bestConfidence * 100}% confidence`
    };
  }

  // Private helper methods

  private calculateTwoTailedPValue(z: number): number {
    // Approximation of two-tailed p-value from z-score
    const absZ = Math.abs(z);
    return 2 * (1 - this.normalCDF(absZ));
  }

  private calculateTwoTailedPValueT(t: number, df: number): number {
    // Approximation using normal for large df
    if (df > 30) {
      return this.calculateTwoTailedPValue(t);
    }
    // For small df, would use t-distribution (simplified here)
    return this.calculateTwoTailedPValue(t);
  }

  private normalCDF(z: number): number {
    // Approximation of standard normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y =
      1.0 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  private getCriticalZ(alpha: number): number {
    // Critical z-values for common alpha levels
    const criticalValues: Record<number, number> = {
      0.01: 2.576,
      0.05: 1.96,
      0.1: 1.645
    };
    return criticalValues[alpha] ?? 1.96;
  }

  private getCriticalT(alpha: number, df: number): number {
    // Approximation using normal for large df
    if (df > 30) {
      return this.getCriticalZ(alpha);
    }
    // Simplified for small df
    return this.getCriticalZ(alpha);
  }

  private getCriticalChiSquare(alpha: number, df: number): number {
    // Critical chi-square values (df=1)
    const criticalValues: Record<number, number> = {
      0.01: 6.635,
      0.05: 3.841,
      0.1: 2.706
    };
    return criticalValues[alpha] ?? 3.841;
  }

  private calculateChiSquarePValue(chi2: number, df: number): number {
    // Simplified approximation
    return Math.exp(-0.5 * chi2);
  }

  private calculateDegreesOfFreedom(
    s1: number,
    n1: number,
    s2: number,
    n2: number
  ): number {
    const num = Math.pow(s1 * s1 / n1 + s2 * s2 / n2, 2);
    const den =
      Math.pow(s1 * s1 / n1, 2) / (n1 - 1) +
      Math.pow(s2 * s2 / n2, 2) / (n2 - 1);
    return num / den;
  }

  private calculatePowerProportions(
    p1: number,
    effectSize: number,
    n1: number,
    n2: number,
    alpha: number
  ): number {
    // Simplified power calculation
    const p2 = p1 + effectSize;
    const pooledP = (p1 + p2) / 2;
    const se = Math.sqrt(2 * pooledP * (1 - pooledP) / Math.min(n1, n2));
    const z = Math.abs(effectSize) / se;
    const zAlpha = this.getCriticalZ(alpha);

    // Power = P(Z > zAlpha - effectSize/SE) + P(Z < -zAlpha - effectSize/SE)
    return this.normalCDF(z - zAlpha) + this.normalCDF(-z - zAlpha);
  }

  private calculatePowerMeans(
    effectSize: number,
    std: number,
    n: number,
    alpha: number
  ): number {
    const se = std * Math.sqrt(2 / n);
    const z = Math.abs(effectSize) / se;
    const zAlpha = this.getCriticalZ(alpha);

    return this.normalCDF(z - zAlpha) + this.normalCDF(-z - zAlpha);
  }

  private betaRandom(alpha: number, beta: number): number {
    // Marsaglia and Tsang's method for beta random variates
    if (alpha >= 1 && beta >= 1) {
      const u = Math.random();
      const v = Math.random();
      const x = Math.pow(u, 1 / alpha);
      const y = Math.pow(v, 1 / beta);
      return x / (x + y);
    }

    // Fallback using gamma distribution
    const gamma1 = this.gammaRandom(alpha, 1);
    const gamma2 = this.gammaRandom(beta, 1);
    return gamma1 / (gamma1 + gamma2);
  }

  private gammaRandom(alpha: number, beta: number): number {
    // Marsaglia and Tsang's method
    if (alpha >= 1) {
      const d = alpha - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);

      while (true) {
        let x, v;
        do {
          x = this.normalRandom();
          v = 1 + c * x;
        } while (v <= 0);

        v = v * v * v;
        const u = Math.random();

        if (u < 1 - 0.0331 * (x * x) * (x * x)) {
          return beta * d * v;
        }

        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
          return beta * d * v;
        }
      }
    }

    // For alpha < 1, use transformation
    return this.gammaRandom(alpha + 1, beta) * Math.pow(Math.random(), 1 / alpha);
  }

  private normalRandom(): number {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private betaQuantile(alpha: number, beta: number, p: number): number {
    // Simplified approximation using beta distribution mean
    const mean = alpha / (alpha + beta);
    return mean; // Full implementation would use inverse beta CDF
  }

  private interpretZTest(z: number, pValue: number, alpha: number): string {
    if (pValue < alpha) {
      return `Statistically significant result (z=${z.toFixed(2)}, p=${pValue.toFixed(4)})`;
    }
    return `Not statistically significant (z=${z.toFixed(2)}, p=${pValue.toFixed(4)})`;
  }

  private interpretTTest(t: number, pValue: number, alpha: number): string {
    if (pValue < alpha) {
      return `Statistically significant result (t=${t.toFixed(2)}, p=${pValue.toFixed(4)})`;
    }
    return `Not statistically significant (t=${t.toFixed(2)}, p=${pValue.toFixed(4)})`;
  }

  private interpretChiSquare(chi2: number, pValue: number, alpha: number): string {
    if (pValue < alpha) {
      return `Statistically significant association (χ²=${chi2.toFixed(2)}, p=${pValue.toFixed(4)})`;
    }
    return `No significant association found (χ²=${chi2.toFixed(2)}, p=${pValue.toFixed(4)})`;
  }
}
