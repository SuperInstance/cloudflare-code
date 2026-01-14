/**
 * Statistical Analysis Module
 * Comprehensive statistical analysis for analytics data
 */

import type {
  StatisticalAnalysis,
  DescriptiveStatistics,
  InferentialStatistics,
  TrendAnalysis,
  CorrelationAnalysis,
  AnomalyDetection,
  ForecastingAnalysis,
  StatisticalTest,
  ChangePoint,
  Anomaly,
  ForecastPoint,
} from '../types/index.js';

export interface StatisticsConfig {
  confidenceLevel: number;
  significanceLevel: number;
  enableSeasonality: boolean;
  forecastHorizon: number;
  anomalyThreshold: number;
}

/**
 * Statistical Analyzer
 */
export class StatisticalAnalyzer {
  private config: StatisticsConfig;

  constructor(config: Partial<StatisticsConfig> = {}) {
    this.config = {
      confidenceLevel: 0.95,
      significanceLevel: 0.05,
      enableSeasonality: true,
      forecastHorizon: 30,
      anomalyThreshold: 2.5,
      ...config,
    };
  }

  /**
   * Perform comprehensive statistical analysis
   */
  analyze(data: number[]): StatisticalAnalysis {
    return {
      descriptive: this.descriptive(data),
      inferential: this.inferential(data),
      trend: this.trend(data),
      correlation: this.correlation(data),
      anomaly: this.detectAnomalies(data),
      forecast: this.forecast(data),
    };
  }

  /**
   * Calculate descriptive statistics
   */
  descriptive(data: number[]): DescriptiveStatistics {
    if (data.length === 0) {
      return this.emptyDescriptive();
    }

    const sorted = [...data].sort((a, b) => a - b);
    const n = sorted.length;

    const mean = this.calculateMean(sorted);
    const variance = this.calculateVariance(sorted, mean);
    const std = Math.sqrt(variance);

    return {
      mean,
      median: this.calculateMedian(sorted),
      mode: this.calculateMode(sorted),
      std,
      variance,
      min: sorted[0],
      max: sorted[n - 1],
      quartiles: this.calculateQuartiles(sorted),
      skewness: this.calculateSkewness(sorted, mean, std),
      kurtosis: this.calculateKurtosis(sorted, mean, std),
    };
  }

  /**
   * Calculate inferential statistics
   */
  inferential(data: number[]): InferentialStatistics {
    const tests: StatisticalTest[] = [];

    // Perform various statistical tests
    tests.push(this.tTestOneSample(data, 0));
    tests.push(this.shapiroWilkTest(data));
    tests.push(this.andersonDarlingTest(data));

    return {
      tests,
      significance: this.config.significanceLevel,
      confidence: this.config.confidenceLevel,
    };
  }

  /**
   * Analyze trend
   */
  trend(data: number[]): TrendAnalysis {
    const n = data.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = data;

    // Linear regression
    const { slope, intercept, r2 } = this.linearRegression(xValues, yValues);

    // Determine trend direction
    const trend = this.determineTrend(slope, this.config.significanceLevel);

    // Detect change points
    const changePoints = this.detectChangePoints(data);

    // Detect seasonality
    const seasonality = this.config.enableSeasonality ? this.detectSeasonality(data) : undefined;

    return {
      trend,
      slope,
      correlation: Math.sqrt(r2) * (slope >= 0 ? 1 : -1),
      r2,
      seasonality,
      changePoints,
    };
  }

  /**
   * Analyze correlation (auto-correlation for single series)
   */
  correlation(data: number[]): CorrelationAnalysis {
    const correlations = [];
    const n = data.length;

    // Calculate auto-correlation at different lags
    const maxLag = Math.min(n - 1, 50);
    for (let lag = 1; lag <= maxLag; lag++) {
      const correlation = this.calculateAutoCorrelation(data, lag);
      const significant = Math.abs(correlation) > this.calculateCriticalValue(n, lag);

      correlations.push({
        field1: `lag_${lag}`,
        field2: 'current',
        coefficient: correlation,
        pValue: this.correlationPValue(correlation, n - lag),
        significant,
        strength: this.correlationStrength(Math.abs(correlation)),
      });
    }

    // Find strongest correlation
    const strongest = correlations.reduce((best, curr) =>
      Math.abs(curr.coefficient) > Math.abs(best.coefficient) ? curr : best
    );

    return {
      correlations,
      strongest,
      network: this.buildCorrelationNetwork(correlations),
    };
  }

  /**
   * Detect anomalies
   */
  detectAnomalies(data: number[]): AnomalyDetection {
    const anomalies: Anomaly[] = [];

    // Z-score method
    const stats = this.descriptive(data);
    const threshold = this.config.anomalyThreshold;

    for (let i = 0; i < data.length; i++) {
      const zScore = Math.abs((data[i] - stats.mean) / stats.std);

      if (zScore > threshold) {
        const deviation = Math.abs(data[i] - stats.mean);
        const score = zScore;

        anomalies.push({
          timestamp: i,
          value: data[i],
          expected: stats.mean,
          deviation,
          score,
          severity: this.anomalySeverity(score),
          type: this.anomalyType(data[i], stats.mean),
        });
      }
    }

    return {
      anomalies,
      score: anomalies.length / data.length,
      threshold,
      method: 'z_score',
    };
  }

  /**
   * Forecast future values
   */
  forecast(data: number[]): ForecastingAnalysis {
    const n = data.length;
    const horizon = Math.min(this.config.forecastHorizon, n);

    // Simple exponential smoothing
    const alpha = 0.3;
    const forecast: ForecastPoint[] = [];
    let level = data[0];
    let trend = data.length > 1 ? data[1] - data[0] : 0;

    // Fit model
    for (let i = 1; i < n; i++) {
      const newLevel = alpha * data[i] + (1 - alpha) * (level + trend);
      trend = 0.1 * (newLevel - level) + (1 - 0.1) * trend;
      level = newLevel;
    }

    // Generate forecasts
    const std = Math.sqrt(this.calculateVariance(data, this.calculateMean(data)));
    const confidenceMultiplier = 1.96; // 95% confidence

    for (let i = 1; i <= horizon; i++) {
      const value = level + i * trend;
      const error = std * Math.sqrt(i) * confidenceMultiplier;

      forecast.push({
        timestamp: n + i,
        value,
        lower: value - error,
        upper: value + error,
        confidence: 0.95,
      });
    }

    // Calculate accuracy on training data
    const accuracy = this.calculateForecastAccuracy(data, level, trend);

    return {
      forecast,
      accuracy,
      method: 'exponential_smoothing',
      confidence: 0.95,
      upper: forecast.map((f) => f.upper),
      lower: forecast.map((f) => f.lower),
    };
  }

  /**
   * Calculate mean
   */
  private calculateMean(data: number[]): number {
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  /**
   * Calculate median
   */
  private calculateMedian(sorted: number[]): number {
    const n = sorted.length;
    const mid = Math.floor(n / 2);

    if (n % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculate mode
   */
  private calculateMode(data: number[]): number {
    const frequency = new Map<number, number>();

    for (const value of data) {
      frequency.set(value, (frequency.get(value) || 0) + 1);
    }

    let maxFrequency = 0;
    let mode = data[0];

    for (const [value, freq] of frequency.entries()) {
      if (freq > maxFrequency) {
        maxFrequency = freq;
        mode = value;
      }
    }

    return mode;
  }

  /**
   * Calculate variance
   */
  private calculateVariance(data: number[], mean: number): number {
    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  }

  /**
   * Calculate quartiles
   */
  private calculateQuartiles(sorted: number[]): {
    q1: number;
    q2: number;
    q3: number;
    iqr: number;
  } {
    const n = sorted.length;
    const q1 = this.calculateMedian(sorted.slice(0, Math.floor(n / 2)));
    const q2 = this.calculateMedian(sorted);
    const q3 = this.calculateMedian(sorted.slice(Math.ceil(n / 2)));

    return {
      q1,
      q2,
      q3,
      iqr: q3 - q1,
    };
  }

  /**
   * Calculate skewness
   */
  private calculateSkewness(data: number[], mean: number, std: number): number {
    const n = data.length;
    const sum = data.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0);
    return (n / ((n - 1) * (n - 2))) * sum;
  }

  /**
   * Calculate kurtosis
   */
  private calculateKurtosis(data: number[], mean: number, std: number): number {
    const n = data.length;
    const sum = data.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0);
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
  }

  /**
   * One-sample t-test
   */
  private tTestOneSample(data: number[], nullValue: number): StatisticalTest {
    const n = data.length;
    const mean = this.calculateMean(data);
    const std = Math.sqrt(this.calculateVariance(data, mean));
    const standardError = std / Math.sqrt(n);

    const tStatistic = (mean - nullValue) / standardError;
    const pValue = 2 * (1 - this.tDistribution(Math.abs(tStatistic), n - 1));

    return {
      type: 't_test',
      statistic: tStatistic,
      pValue,
      significant: pValue < this.config.significanceLevel,
      interpretation: this.interpretTTest(tStatistic, pValue),
    };
  }

  /**
   * Shapiro-Wilk test for normality
   */
  private shapiroWilkTest(data: number[]): StatisticalTest {
    // Simplified implementation
    const n = data.length;
    const sorted = [...data].sort((a, b) => a - b);
    const mean = this.calculateMean(sorted);
    const std = Math.sqrt(this.calculateVariance(sorted, mean));

    // Calculate test statistic (simplified)
    const statistic = 1 - (this.calculateSumSquaredDifferences(sorted, mean) / this.calculateSumSquaredDeviations(sorted, mean));
    const pValue = Math.exp(-n * (statistic - 1) * 10); // Approximation

    return {
      type: 'correlation',
      statistic,
      pValue,
      significant: pValue < this.config.significanceLevel,
      interpretation: this.interpretNormalityTest(pValue),
    };
  }

  /**
   * Anderson-Darling test
   */
  private andersonDarlingTest(data: number[]): StatisticalTest {
    const n = data.length;
    const sorted = [...data].sort((a, b) => a - b);
    const mean = this.calculateMean(sorted);
    const std = Math.sqrt(this.calculateVariance(sorted, mean));

    // Standardize data
    const standardized = sorted.map((x) => (x - mean) / std);

    // Calculate Anderson-Darling statistic
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const z = standardized[i];
      const cdf = this.normalCDF(z);
      sum += (2 * i + 1) * Math.log(cdf) + (2 * (n - i) + 1) * Math.log(1 - cdf);
    }

    const statistic = -n - sum / n;
    const pValue = Math.exp(-statistic); // Approximation

    return {
      type: 'correlation',
      statistic,
      pValue,
      significant: pValue < this.config.significanceLevel,
      interpretation: this.interpretNormalityTest(pValue),
    };
  }

  /**
   * Linear regression
   */
  private linearRegression(xValues: number[], yValues: number[]): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = xValues.length;

    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = this.calculateMean(yValues);
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
      const predicted = slope * xValues[i] + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);

    const r2 = 1 - ssResidual / ssTotal;

    return { slope, intercept, r2 };
  }

  /**
   * Determine trend
   */
  private determineTrend(
    slope: number,
    significanceLevel: number
  ): 'increasing' | 'decreasing' | 'stable' {
    if (Math.abs(slope) < significanceLevel) {
      return 'stable';
    }
    return slope > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Detect change points
   */
  private detectChangePoints(data: number[]): ChangePoint[] {
    const changePoints: ChangePoint[] = [];
    const windowSize = Math.max(10, Math.floor(data.length / 10));

    for (let i = windowSize; i < data.length - windowSize; i++) {
      const before = data.slice(i - windowSize, i);
      const after = data.slice(i, i + windowSize);

      const beforeMean = this.calculateMean(before);
      const afterMean = this.calculateMean(after);

      const difference = Math.abs(afterMean - beforeMean);
      const pooledStd = Math.sqrt(
        (this.calculateVariance(before, beforeMean) * before.length +
          this.calculateVariance(after, afterMean) * after.length) /
          (before.length + after.length)
      );

      const magnitude = difference / pooledStd;

      if (magnitude > 3) {
        // Significant change point
        changePoints.push({
          timestamp: i,
          before: beforeMean,
          after: afterMean,
          magnitude,
          confidence: Math.min(1, magnitude / 5),
        });
      }
    }

    return changePoints;
  }

  /**
   * Detect seasonality
   */
  private detectSeasonality(data: number[]): any {
    const n = data.length;
    const autocorrelations: number[] = [];

    // Calculate autocorrelation at different lags
    for (let lag = 1; lag <= Math.min(n / 2, 100); lag++) {
      autocorrelations.push(this.calculateAutoCorrelation(data, lag));
    }

    // Find peaks in autocorrelation
    const peaks: number[] = [];
    for (let i = 1; i < autocorrelations.length - 1; i++) {
      if (autocorrelations[i] > autocorrelations[i - 1] && autocorrelations[i] > autocorrelations[i + 1]) {
        peaks.push(i);
      }
    }

    // Determine seasonality period
    const period = peaks.length > 0 ? peaks[0] : 0;
    const strength = period > 0 ? autocorrelations[period] : 0;

    return {
      detected: strength > 0.3,
      pattern: this.determineSeasonalityPattern(period),
      period,
      strength,
      peaks,
      troughs: peaks.map((p) => p + Math.floor(period / 2)),
    };
  }

  /**
   * Determine seasonality pattern
   */
  private determineSeasonalityPattern(period: number): any {
    if (period === 0) return 'none';
    if (period <= 24) return 'daily';
    if (period <= 168) return 'weekly';
    if (period <= 720) return 'monthly';
    return 'yearly';
  }

  /**
   * Calculate auto-correlation
   */
  private calculateAutoCorrelation(data: number[], lag: number): number {
    const n = data.length;
    const mean = this.calculateMean(data);

    let sumNumerator = 0;
    let sumDenominator = 0;

    for (let i = 0; i < n - lag; i++) {
      sumNumerator += (data[i] - mean) * (data[i + lag] - mean);
    }

    for (let i = 0; i < n; i++) {
      sumDenominator += Math.pow(data[i] - mean, 2);
    }

    return sumNumerator / sumDenominator;
  }

  /**
   * Calculate critical value for correlation
   */
  private calculateCriticalValue(n: number, lag: number): number {
    return 1.96 / Math.sqrt(n - lag);
  }

  /**
   * Calculate p-value for correlation
   */
  private correlationPValue(correlation: number, n: number): number {
    const t = (correlation * Math.sqrt(n - 2)) / Math.sqrt(1 - correlation * correlation);
    return 2 * (1 - this.tDistribution(Math.abs(t), n - 2));
  }

  /**
   * Get correlation strength
   */
  private correlationStrength(absCorrelation: number): any {
    if (absCorrelation < 0.2) return 'very_weak';
    if (absCorrelation < 0.4) return 'weak';
    if (absCorrelation < 0.6) return 'moderate';
    if (absCorrelation < 0.8) return 'strong';
    return 'very_strong';
  }

  /**
   * Build correlation network
   */
  private buildCorrelationNetwork(correlations: any[]): any {
    const nodes = new Map<string, { connections: number; centrality: number }>();
    const edges: any[] = [];

    for (const corr of correlations) {
      if (corr.significant) {
        edges.push({
          source: corr.field1,
          target: corr.field2,
          coefficient: corr.coefficient,
          strength: corr.strength,
        });

        if (!nodes.has(corr.field1)) {
          nodes.set(corr.field1, { connections: 0, centrality: 0 });
        }
        if (!nodes.has(corr.field2)) {
          nodes.set(corr.field2, { connections: 0, centrality: 0 });
        }

        nodes.get(corr.field1)!.connections++;
        nodes.get(corr.field2)!.connections++;
      }
    }

    // Calculate centrality
    const totalConnections = edges.length;
    for (const [name, node] of nodes.entries()) {
      node.centrality = node.connections / totalConnections;
    }

    return {
      nodes: Array.from(nodes.entries()).map(([name, data]) => ({
        field: name,
        ...data,
      })),
      edges,
    };
  }

  /**
   * Get anomaly severity
   */
  private anomalySeverity(score: number): any {
    if (score < 3) return 'low';
    if (score < 4) return 'medium';
    if (score < 5) return 'high';
    return 'critical';
  }

  /**
   * Get anomaly type
   */
  private anomalyType(value: number, mean: number): 'spike' | 'drop' | 'trend_shift' | 'pattern_change' {
    if (value > mean * 1.5) return 'spike';
    if (value < mean * 0.5) return 'drop';
    return 'pattern_change';
  }

  /**
   * Calculate forecast accuracy
   */
  private calculateForecastAccuracy(data: number[], level: number, trend: number): number {
    const errors: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const forecast = level + i * trend;
      errors.push(Math.pow(data[i] - forecast, 2));
    }

    const mse = this.calculateMean(errors);
    return 1 / (1 + mse); // Convert to accuracy score
  }

  /**
   * Calculate sum of squared differences
   */
  private calculateSumSquaredDifferences(data: number[], mean: number): number {
    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  }

  /**
   * Calculate sum of squared deviations
   */
  private calculateSumSquaredDeviations(data: number[], mean: number): number {
    return data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  }

  /**
   * Normal CDF
   */
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
    const y =
      1.0 -
      (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * T-distribution CDF (approximation)
   */
  private tDistribution(t: number, df: number): number {
    // Approximation for large df
    if (df > 100) {
      return this.normalCDF(t);
    }

    // Simple approximation
    const x = df / (df + t * t);
    return 1 - 0.5 * Math.pow(x, df / 2);
  }

  /**
   * Interpret t-test result
   */
  private interpretTTest(statistic: number, pValue: number): string {
    if (pValue < 0.001) return 'Extremely significant';
    if (pValue < 0.01) return 'Very significant';
    if (pValue < 0.05) return 'Significant';
    if (pValue < 0.1) return 'Marginally significant';
    return 'Not significant';
  }

  /**
   * Interpret normality test
   */
  private interpretNormalityTest(pValue: number): string {
    if (pValue < 0.001) return 'Strong evidence against normality';
    if (pValue < 0.01) return 'Very strong evidence against normality';
    if (pValue < 0.05) return 'Strong evidence against normality';
    if (pValue < 0.1) return 'Moderate evidence against normality';
    return 'No significant evidence against normality';
  }

  /**
   * Create empty descriptive statistics
   */
  private emptyDescriptive(): DescriptiveStatistics {
    return {
      mean: 0,
      median: 0,
      mode: 0,
      std: 0,
      variance: 0,
      min: 0,
      max: 0,
      quartiles: { q1: 0, q2: 0, q3: 0, iqr: 0 },
      skewness: 0,
      kurtosis: 0,
    };
  }
}

/**
 * Hypothesis Tester
 */
export class HypothesisTester {
  /**
   * Perform A/B test
   */
  static abTest(
    control: number[],
    variant: number[],
    alpha = 0.05
  ): { statistic: number; pValue: number; significant: boolean; lift: number } {
    const n1 = control.length;
    const n2 = variant.length;
    const mean1 = control.reduce((a, b) => a + b, 0) / n1;
    const mean2 = variant.reduce((a, b) => a + b, 0) / n2;
    const var1 = control.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
    const var2 = variant.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

    const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
    const standardError = pooledStd * Math.sqrt(1 / n1 + 1 / n2);

    const tStatistic = (mean2 - mean1) / standardError;
    const df = n1 + n2 - 2;

    // Approximate p-value
    const pValue = 2 * (1 - new StatisticalAnalyzer().tDistribution(Math.abs(tStatistic), df));

    const lift = ((mean2 - mean1) / mean1) * 100;

    return {
      statistic: tStatistic,
      pValue,
      significant: pValue < alpha,
      lift,
    };
  }

  /**
   * Chi-square test
   */
  static chiSquare(observed: number[][], expected?: number[][]): {
    statistic: number;
    pValue: number;
    significant: boolean;
  } {
    const rows = observed.length;
    const cols = observed[0].length;

    // Calculate expected if not provided
    if (!expected) {
      expected = [];
      const rowTotals = observed.map((row) => row.reduce((a, b) => a + b, 0));
      const colTotals = observed[0].map((_, j) =>
        observed.reduce((sum, row) => sum + row[j], 0)
      );
      const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

      for (let i = 0; i < rows; i++) {
        expected[i] = [];
        for (let j = 0; j < cols; j++) {
          expected[i][j] = (rowTotals[i] * colTotals[j]) / grandTotal;
        }
      }
    }

    // Calculate chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        chiSquare += Math.pow(observed[i][j] - expected[i][j], 2) / expected[i][j];
      }
    }

    const df = (rows - 1) * (cols - 1);
    const pValue = 1 - new StatisticalAnalyzer().chiSquareCDF(chiSquare, df);

    return {
      statistic: chiSquare,
      pValue,
      significant: pValue < 0.05,
    };
  }

  /**
   * Chi-square CDF (approximation)
   */
  private static chiSquareCDF(x: number, df: number): number {
    // Simple approximation
    return 1 - Math.exp(-x / 2);
  }
}
