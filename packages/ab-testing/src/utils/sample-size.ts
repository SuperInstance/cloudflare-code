/**
 * Sample Size Calculator - Statistical power analysis for
 * determining required sample sizes for experiments
 */

import type { SampleSizeParams } from '../types/experiment.js';

/**
 * Sample size calculation result
 */
export interface SampleSizeResult {
  /** Required sample size per variant */
  sampleSize: number;
  /** Total sample size across all variants */
  totalSampleSize: number;
  /** Power achieved */
  power: number;
  /** Expected duration (based on daily traffic) */
  expectedDuration?: number;
}

/**
 * Sample Size Calculator class
 */
export class SampleSizeCalculator {
  /**
   * Calculate sample size for an experiment
   */
  calculateSampleSize(params: SampleSizeParams): number {
    const {
      minimumDetectableEffect,
      power,
      alpha,
      baselineRate,
      standardDeviation,
      variantsCount
    } = params;

    // Get critical values
    const zAlpha = this.getZCritical(1 - alpha / 2);
    const zBeta = this.getZCritical(power);

    if (baselineRate !== undefined) {
      // Binary outcome (proportions)
      return this.calculateProportionSampleSize(
        baselineRate,
        minimumDetectableEffect,
        alpha,
        power
      );
    } else if (standardDeviation !== undefined) {
      // Continuous outcome (means)
      return this.calculateMeanSampleSize(
        standardDeviation,
        minimumDetectableEffect,
        alpha,
        power
      );
    } else {
      // Default using medium effect size
      return this.calculateDefaultSampleSize(
        minimumDetectableEffect,
        alpha,
        power
      );
    }
  }

  /**
   * Calculate sample size for proportion tests
   */
  calculateProportionSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    alpha: number = 0.05,
    power: number = 0.8
  ): number {
    const p1 = baselineRate;
    const p2 = baselineRate + minimumDetectableEffect;

    // Pooled proportion
    const pBar = (p1 + p2) / 2;

    // Z critical values
    const zAlpha = this.getZCritical(1 - alpha / 2);
    const zBeta = this.getZCritical(power);

    // Sample size formula for two-proportion z-test
    const numerator =
      (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
        zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2;

    const denominator = (p2 - p1) ** 2;

    const n = Math.ceil(numerator / denominator);

    return Math.max(n, 100); // Minimum 100 samples
  }

  /**
   * Calculate sample size for mean tests
   */
  calculateMeanSampleSize(
    standardDeviation: number,
    minimumDetectableEffect: number,
    alpha: number = 0.05,
    power: number = 0.8
  ): number {
    // Z critical values
    const zAlpha = this.getZCritical(1 - alpha / 2);
    const zBeta = this.getZCritical(power);

    // Sample size formula for two-sample t-test
    const n =
      (2 * (standardDeviation ** 2) * (zAlpha + zBeta) ** 2) /
      (minimumDetectableEffect ** 2);

    return Math.ceil(Math.max(n, 100));
  }

  /**
   * Calculate default sample size
   */
  calculateDefaultSampleSize(
    effectSize: number,
    alpha: number = 0.05,
    power: number = 0.8
  ): number {
    // Using Cohen's d
    const zAlpha = this.getZCritical(1 - alpha / 2);
    const zBeta = this.getZCritical(power);

    const n = (2 * (zAlpha + zBeta) ** 2) / (effectSize ** 2);

    return Math.ceil(Math.max(n, 100));
  }

  /**
   * Calculate power for given sample size
   */
  calculatePower(
    sampleSize: number,
    effectSize: number,
    alpha: number = 0.05,
    baselineRate?: number
  ): number {
    const zAlpha = this.getZCritical(1 - alpha / 2);

    let z = 0;

    if (baselineRate !== undefined) {
      const p1 = baselineRate;
      const p2 = baselineRate + effectSize;
      const pBar = (p1 + p2) / 2;
      const se = Math.sqrt(2 * pBar * (1 - pBar) / sampleSize);
      z = effectSize / se;
    } else {
      const se = effectSize / Math.sqrt(sampleSize / 2);
      z = effectSize / se;
    }

    // Power = P(Z > zAlpha - z) + P(Z < -zAlpha - z)
    const power = 0.5 * (1 + this.erf((z - zAlpha) / Math.sqrt(2)));

    return Math.min(0.99, Math.max(0.01, power));
  }

  /**
   * Calculate minimum detectable effect for given sample size
   */
  calculateMDE(
    sampleSize: number,
    power: number = 0.8,
    alpha: number = 0.05,
    baselineRate?: number
  ): number {
    const zAlpha = this.getZCritical(1 - alpha / 2);
    const zBeta = this.getZCritical(power);

    if (baselineRate !== undefined) {
      const pBar = baselineRate;
      const numerator =
        (zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
          zBeta * Math.sqrt(2 * pBar * (1 - pBar)));

      const mde = numerator / Math.sqrt(sampleSize);

      return mde;
    } else {
      const mde = (zAlpha + zBeta) * Math.sqrt(2 / sampleSize);
      return mde;
    }
  }

  /**
   * Generate sample size curve
   */
  generateSampleSizeCurve(
    effectSizes: number[],
    alpha: number = 0.05,
    power: number = 0.8,
    baselineRate?: number
  ): Array<{ effectSize: number; sampleSize: number }> {
    return effectSizes.map(effectSize => ({
      effectSize,
      sampleSize: this.calculateSampleSize({
        minimumDetectableEffect: effectSize,
        alpha,
        power,
        baselineRate,
        variantsCount: 2
      })
    }));
  }

  /**
   * Generate power curve
   */
  generatePowerCurve(
    sampleSizes: number[],
    effectSize: number,
    alpha: number = 0.05,
    baselineRate?: number
  ): Array<{ sampleSize: number; power: number }> {
    return sampleSizes.map(sampleSize => ({
      sampleSize,
      power: this.calculatePower(sampleSize, effectSize, alpha, baselineRate)
    }));
  }

  /**
   * Calculate duration estimate
   */
  calculateDuration(
    requiredSampleSize: number,
    dailyTraffic: number,
    allocationPercentage: number = 1
  ): {
    days: number;
    hours: number;
    milliseconds: number;
  } {
    const dailyAllocated = dailyTraffic * allocationPercentage;
    const daysNeeded = Math.ceil(requiredSampleSize / dailyAllocated);

    return {
      days: daysNeeded,
      hours: daysNeeded * 24,
      milliseconds: daysNeeded * 24 * 60 * 60 * 1000
    };
  }

  /**
   * Recommend sample size based on best practices
   */
  recommendSampleSize(
    baselineRate: number,
    targetMDE: number,
    dailyTraffic: number
  ): SampleSizeResult {
    // Calculate for different scenarios
    const conservative = this.calculateProportionSampleSize(
      baselineRate,
      targetMDE,
      0.01, // Very conservative alpha
      0.9 // High power
    );

    const standard = this.calculateProportionSampleSize(
      baselineRate,
      targetMDE,
      0.05,
      0.8
    );

    const aggressive = this.calculateProportionSampleSize(
      baselineRate,
      targetMDE,
      0.1,
      0.7
    );

    // Use standard as recommendation
    const duration = this.calculateDuration(standard, dailyTraffic);

    return {
      sampleSize: standard,
      totalSampleSize: standard * 2, // For 2 variants
      power: 0.8,
      expectedDuration: duration.milliseconds
    };
  }

  // Private helper methods

  private getZCritical(confidence: number): number {
    // Approximation of inverse normal CDF
    const c = [
      2.515517,
      0.802853,
      0.010328
    ];
    const d = [
      1.432788,
      0.189269,
      0.001308
    ];

    const p = confidence;
    const t = Math.sqrt(-2 * Math.log(1 - p));

    let z = t;
    z -= ((c[2] * t + c[1]) * t + c[0]) / (((d[2] * t + d[1]) * t + d[0]) * t + 1);

    return z;
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y =
      1.0 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }
}
