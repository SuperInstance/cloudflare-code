/**
 * Statistical Analyzer
 * Statistical tests and analysis for A/B experiments
 */

export interface SampleSizeConfig {
  baseline: number;
  minimumDetectableEffect: number;
  alpha: number;
  power: number;
  testType: string;
}

export interface TestConfig {
  testType: string;
  controlValues: number[];
  treatmentValues: number[];
  alpha: number;
  alternative?: 'two-sided' | 'greater' | 'less';
}

export interface TestResult {
  statistic: number;
  pValue: number;
  effectSize: number;
  power: number;
  confidenceInterval: { lower: number; upper: number; level: number };
}

export class StatisticalAnalyzer {
  /**
   * Calculate required sample size for experiment
   */
  calculateSampleSize(config: SampleSizeConfig): number {
    const { baseline, minimumDetectableEffect, alpha, power } = config;

    // Z-scores for alpha and power
    const zAlpha = this.getZScore(1 - alpha / 2);
    const zBeta = this.getZScore(power);

    // Proportions
    const p1 = baseline;
    const p2 = baseline + minimumDetectableEffect;
    const pBar = (p1 + p2) / 2;

    // Sample size formula for two-proportion z-test
    const n =
      (2 * pBar * (1 - pBar) * Math.pow(zAlpha + zBeta, 2)) /
      Math.pow(p2 - p1, 2);

    // Add 10% buffer
    return Math.ceil(n * 1.1);
  }

  /**
   * Run statistical test
   */
  async runTest(config: TestConfig): Promise<TestResult> {
    switch (config.testType) {
      case 't_test':
        return this.tTest(config.controlValues, config.treatmentValues, config.alpha);
      case 'welch':
        return this.welchTest(config.controlValues, config.treatmentValues, config.alpha);
      case 'mann_whitney':
        return this.mannWhitneyTest(config.controlValues, config.treatmentValues, config.alpha);
      case 'chi_square':
        return this.chiSquareTest(config.controlValues, config.treatmentValues, config.alpha);
      case 'bayesian':
        return this.bayesianTest(config.controlValues, config.treatmentValues, config.alpha);
      default:
        throw new Error(`Unknown test type: ${config.testType}`);
    }
  }

  /**
   * Calculate effect size (Cohen's d)
   */
  calculateEffectSize(control: number[], treatment: number[]): number {
    const controlMean = this.mean(control);
    const treatmentMean = this.mean(treatment);

    const pooledStd = this.pooledStandardDeviation(control, treatment);

    return (treatmentMean - controlMean) / pooledStd;
  }

  /**
   * Calculate statistical power
   */
  calculatePower(config: {
    sampleSize: number;
    effectSize: number;
    alpha: number;
  }): number {
    const { sampleSize, effectSize, alpha } = config;

    // Approximate power calculation
    const zAlpha = this.getZScore(1 - alpha / 2);
    const zPower = effectSize * Math.sqrt(sampleSize / 2) - zAlpha;

    return this.normalCDF(zPower);
  }

  /**
   * Sequential testing analysis
   */
  sequentialTest(
    data: Array<{ control: number[]; treatment: number[] }>,
    alphaSpending: 'obrien_fleming' | 'pocock' | 'custom',
    alpha: number = 0.05
  ): Array<{ statistic: number; pValue: number; boundary: number; significant: boolean }> {
    const results = [];
    const k = data.length;

    for (let i = 0; i < k; i++) {
      const { control, treatment } = data[i];
      const result = this.tTest(control, treatment, 1);

      // Calculate alpha spending boundary
      let boundary: number;
      if (alphaSpending === 'obrien_fleming') {
        boundary = this.getZScore(1 - alpha / (2 * (i + 1)));
      } else if (alphaSpending === 'pocock') {
        boundary = this.getZScore(1 - alpha / (2 * k));
      } else {
        boundary = this.getZScore(1 - alpha / 2);
      }

      const zScore = this.getZScore(1 - result.pValue / 2);
      const significant = Math.abs(zScore) > boundary;

      results.push({
        statistic: result.statistic,
        pValue: result.pValue,
        boundary,
        significant,
      });
    }

    return results;
  }

  /**
   * Bayesian analysis
   */
  bayesianAnalysis(
    control: number[],
    treatment: number[],
    prior: { mean: number; variance: number }
  ): {
    posteriorControl: { mean: number; variance: number };
    posteriorTreatment: { mean: number; variance: number };
    probabilityTreatmentBetter: number;
    expectedLoss: number;
  } {
    // Normal-Normal conjugate model
    const n1 = control.length;
    const n2 = treatment.length;
    const mean1 = this.mean(control);
    const mean2 = this.mean(treatment);
    const var1 = this.variance(control);
    const var2 = this.variance(treatment);

    // Posterior parameters
    const postVar1 = 1 / ((1 / prior.variance) + (n1 / var1));
    const postMean1 = postVar1 * ((prior.mean / prior.variance) + (n1 * mean1 / var1));

    const postVar2 = 1 / ((1 / prior.variance) + (n2 / var2));
    const postMean2 = postVar2 * ((prior.mean / prior.variance) + (n2 * mean2 / var2));

    // Probability that treatment is better
    const meanDiff = postMean2 - postMean1;
    const varDiff = postVar1 + postVar2;
    const probBetter = 1 - this.normalCDF(-meanDiff / Math.sqrt(varDiff));

    // Expected loss
    const expectedLoss = this.calculateExpectedLoss(postMean1, postVar1, postMean2, postVar2);

    return {
      posteriorControl: { mean: postMean1, variance: postVar1 },
      posteriorTreatment: { mean: postMean2, variance: postVar2 },
      probabilityTreatmentBetter: probBetter,
      expectedLoss,
    };
  }

  /**
   * Multi-armed bandit (Thompson Sampling)
   */
  thompsonSampling(
    arms: Map<string, { successes: number; failures: number }>
  ): { selectedArm: string; probabilities: Map<string, number> } {
    const samples = new Map<string, number>();

    for (const [arm, stats] of arms.entries()) {
      // Sample from Beta distribution
      const sample = this.betaSample(stats.successes + 1, stats.failures + 1);
      samples.set(arm, sample);
    }

    // Select arm with highest sample
    let selectedArm = '';
    let maxSample = -Infinity;

    for (const [arm, sample] of samples.entries()) {
      if (sample > maxSample) {
        maxSample = sample;
        selectedArm = arm;
      }
    }

    return { selectedArm, probabilities: samples };
  }

  // ==========================================================================
  // Statistical Tests
  // ==========================================================================

  private tTest(
    control: number[],
    treatment: number[],
    alpha: number
  ): TestResult {
    const n1 = control.length;
    const n2 = treatment.length;
    const mean1 = this.mean(control);
    const mean2 = this.mean(treatment);
    const var1 = this.variance(control);
    const var2 = this.variance(treatment);

    // Pooled standard deviation
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    const pooledStd = Math.sqrt(pooledVar);

    // T-statistic
    const se = pooledStd * Math.sqrt(1 / n1 + 1 / n2);
    const t = (mean2 - mean1) / se;

    // Degrees of freedom
    const df = n1 + n2 - 2;

    // P-value (two-sided)
    const pValue = 2 * (1 - this.tCDF(Math.abs(t), df));

    // Effect size (Cohen's d)
    const effectSize = (mean2 - mean1) / pooledStd;

    // Confidence interval
    const tCritical = this.tInverse(1 - alpha / 2, df);
    const ciLower = (mean2 - mean1) - tCritical * se;
    const ciUpper = (mean2 - mean1) + tCritical * se;

    // Power
    const power = this.calculatePower({
      sampleSize: Math.min(n1, n2),
      effectSize,
      alpha,
    });

    return {
      statistic: t,
      pValue,
      effectSize,
      power,
      confidenceInterval: {
        lower: ciLower,
        upper: ciUpper,
        level: 1 - alpha,
      },
    };
  }

  private welchTest(
    control: number[],
    treatment: number[],
    alpha: number
  ): TestResult {
    const n1 = control.length;
    const n2 = treatment.length;
    const mean1 = this.mean(control);
    const mean2 = this.mean(treatment);
    const var1 = this.variance(control);
    const var2 = this.variance(treatment);

    // T-statistic
    const se = Math.sqrt(var1 / n1 + var2 / n2);
    const t = (mean2 - mean1) / se;

    // Degrees of freedom (Welch-Satterthwaite)
    const df =
      Math.pow(var1 / n1 + var2 / n2, 2) /
      (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

    // P-value
    const pValue = 2 * (1 - this.tCDF(Math.abs(t), df));

    // Effect size (Hedges' g)
    const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
    const effectSize = (mean2 - mean1) / pooledStd;

    // Confidence interval
    const tCritical = this.tInverse(1 - alpha / 2, df);
    const ciLower = (mean2 - mean1) - tCritical * se;
    const ciUpper = (mean2 - mean1) + tCritical * se;

    const power = this.calculatePower({
      sampleSize: Math.min(n1, n2),
      effectSize,
      alpha,
    });

    return {
      statistic: t,
      pValue,
      effectSize,
      power,
      confidenceInterval: {
        lower: ciLower,
        upper: ciUpper,
        level: 1 - alpha,
      },
    };
  }

  private mannWhitneyTest(
    control: number[],
    treatment: number[],
    alpha: number
  ): TestResult {
    // Combine and rank all values
    const combined = [...control.map(v => ({ value: v, group: 0 })), ...treatment.map(v => ({ value: v, group: 1 }))];
    combined.sort((a, b) => a.value - b.value);

    // Assign ranks
    const ranks = combined.map((d, i) => ({
      ...d,
      rank: i + 1,
    }));

    // Sum of ranks for treatment group
    const treatmentRanks = ranks.filter(d => d.group === 1).map(d => d.rank);
    const U = treatmentRanks.reduce((a, b) => a + b, 0);

    const n1 = control.length;
    const n2 = treatment.length;

    // Expected value and standard deviation
    const expectedU = n2 * (n1 + n2 + 1) / 2;
    const stdU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);

    // Z-statistic
    const z = (U - expectedU) / stdU;

    // P-value
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));

    // Effect size (r)
    const effectSize = Math.abs(z) / Math.sqrt(n1 + n2);

    // Confidence interval (approximate)
    const zCritical = this.getZScore(1 - alpha / 2);
    const ciLower = -zCritical * stdU;
    const ciUpper = zCritical * stdU;

    return {
      statistic: z,
      pValue,
      effectSize,
      power: 0, // Not easily calculated for non-parametric
      confidenceInterval: {
        lower: ciLower,
        upper: ciUpper,
        level: 1 - alpha,
      },
    };
  }

  private chiSquareTest(
    control: number[],
    treatment: number[],
    alpha: number
  ): TestResult {
    // Assuming binary data (0/1)
    const controlSuccesses = control.filter(v => v === 1).length;
    const controlFailures = control.length - controlSuccesses;
    const treatmentSuccesses = treatment.filter(v => v === 1).length;
    const treatmentFailures = treatment.length - treatmentSuccesses;

    const rowSums = [controlSuccesses + controlFailures, treatmentSuccesses + treatmentFailures];
    const colSums = [controlSuccesses + treatmentSuccesses, controlFailures + treatmentFailures];
    const total = control.length + treatment.length;

    // Expected values
    const expected = [
      (rowSums[0] * colSums[0]) / total,
      (rowSums[0] * colSums[1]) / total,
      (rowSums[1] * colSums[0]) / total,
      (rowSums[1] * colSums[1]) / total,
    ];

    // Chi-square statistic
    const observed = [controlSuccesses, controlFailures, treatmentSuccesses, treatmentFailures];
    const chiSquare = observed.reduce((sum, o, i) => sum + Math.pow(o - expected[i], 2) / expected[i], 0);

    // P-value
    const pValue = 1 - this.chiSquareCDF(chiSquare, 1);

    // Effect size (phi coefficient)
    const effectSize = Math.sqrt(chiSquare / total);

    return {
      statistic: chiSquare,
      pValue,
      effectSize,
      power: 0,
      confidenceInterval: {
        lower: 0,
        upper: 0,
        level: 1 - alpha,
      },
    };
  }

  private bayesianTest(
    control: number[],
    treatment: number[],
    alpha: number
  ): TestResult {
    // Use weak prior
    const prior = { mean: 0, variance: 100 };

    const analysis = this.bayesianAnalysis(control, treatment, prior);

    // Convert probability to approximate p-value
    const pValue = 1 - analysis.probabilityTreatmentBetter;

    // Effect size
    const effectSize = this.calculateEffectSize(control, treatment);

    return {
      statistic: analysis.probabilityTreatmentBetter,
      pValue,
      effectSize,
      power: analysis.probabilityTreatmentBetter,
      confidenceInterval: {
        lower: analysis.posteriorTreatment.mean - 1.96 * Math.sqrt(analysis.posteriorTreatment.variance),
        upper: analysis.posteriorTreatment.mean + 1.96 * Math.sqrt(analysis.posteriorTreatment.variance),
        level: 1 - alpha,
      },
    };
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private variance(values: number[]): number {
    const m = this.mean(values);
    return values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (values.length - 1);
  }

  private pooledStandardDeviation(control: number[], treatment: number[]): number {
    const n1 = control.length;
    const n2 = treatment.length;
    const var1 = this.variance(control);
    const var2 = this.variance(treatment);

    return Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  }

  private calculateExpectedLoss(
    mean1: number,
    var1: number,
    mean2: number,
    var2: number
  ): number {
    const meanDiff = mean2 - mean1;
    const varDiff = var1 + var2;
    const stdDiff = Math.sqrt(varDiff);

    // Expected loss if choosing treatment when control is better
    const z = meanDiff / stdDiff;
    const phi = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

    return -meanDiff * (1 - this.normalCDF(z)) + stdDiff * phi(z);
  }

  private betaSample(alpha: number, beta: number): number {
    // Approximation using gamma distribution
    const gamma = (shape: number) => {
      const d = shape - 1 / 3;
      const c = 1 / Math.sqrt(9 * d);

      for (let i = 0; i < 100; i++) {
        const x = this.normalRandom();
        const v = (1 + c * x) ** 3;
        if (v > 0) {
          const u = Math.random();
          if (u < 1 - 0.0331 * (x ** 4)) {
            return d * v;
          }
        }
      }
      return d;
    };

    const g1 = gamma(alpha);
    const g2 = gamma(beta);

    return g1 / (g1 + g2);
  }

  private normalRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private getZScore(probability: number): number {
    // Approximation of inverse normal CDF
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    const p = probability;
    const q = Math.min(p, 1 - p);
    let r, z;

    if (q > 0.02425) {
      r = Math.sqrt(-Math.log(q));
      z = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
    } else {
      r = q;
      z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) / ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + 1);
    }

    return p > 0.5 ? -z : z;
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  private tCDF(t: number, df: number): number {
    // Approximation of t-distribution CDF
    const x = (df + 0.5) / (df + t * t);
    const a = new Array(13).fill(0);
    a[1] = 0.333333333;
    a[2] = -0.25;
    a[3] = 0.1;
    a[4] = -0.0535714286;
    a[5] = 0.0333333333;
    a[6] = -0.0227272727;
    a[7] = 0.0163265306;
    a[8] = -0.0121951220;
    a[9] = 0.0093939394;
    a[10] = -0.0074074074;
    a[11] = 0.0059471765;
    a[12] = -0.0048427545;

    let sum = 0;
    for (let i = 1; i <= 12; i++) {
      sum += a[i] * Math.pow(1 - x, i - 1);
    }

    if (t >= 0) {
      return 0.5 + 0.5 * Math.sqrt(1 - Math.pow(x, df)) * sum;
    } else {
      return 0.5 - 0.5 * Math.sqrt(1 - Math.pow(x, df)) * sum;
    }
  }

  private tInverse(p: number, df: number): number {
    // Approximation of inverse t-distribution
    if (df === Infinity) {
      return this.getZScore(p);
    }

    // Use approximation
    const x = this.normalCDFInverse(p);
    return x * (1 + (1 + x * x) / (4 * df) + (3 + 11 * x * x + x * x * x * x) / (96 * df * df));
  }

  private normalCDFInverse(p: number): number {
    // Beasley-Springer-Moro approximation
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    const q = Math.min(p, 1 - p);
    let t, z;

    if (q > 0.02425) {
      const r = Math.sqrt(-Math.log(q));
      z = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
    } else {
      const r = q;
      z = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) / ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + 1);
    }

    return p > 0.5 ? -z : z;
  }

  private chiSquareCDF(x: number, df: number): number {
    // Approximation for chi-square CDF
    if (x <= 0) return 0;

    const a = 2 / (9 * df);
    const b = Math.pow(x / df, 1 / 3);

    return this.normalCDF((b - 1 + a) / Math.sqrt(a));
  }
}
