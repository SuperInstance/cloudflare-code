/**
 * Cohort Analysis Module
 * Analyze user cohorts, retention curves, and LTV by cohort
 */

import type {
  AnalyticsEvent,
  CohortAnalysis,
  Cohort,
  CohortType,
  CohortMetrics,
  CohortRetentionAnalysis,
  RetentionTable,
  RetentionRow,
  RetentionCurve,
  RetentionSummary,
  CohortRevenueAnalysis,
  CohortRevenueCurve,
  CohortLTVAnalysis,
  LTVCurve,
  LTVProjection,
  LTVComparison,
  CohortComparison,
  ComparisonMetric,
  StatisticalComparison,
} from '../types/index.js';

/**
 * Cohort Analysis Engine
 */
export class CohortAnalyzer {
  /**
   * Perform comprehensive cohort analysis
   */
  async analyze(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<CohortAnalysis> {
    const cohorts = await this.buildCohorts(events, timeRange);
    const retention = await this.analyzeRetention(events, cohorts);
    const revenue = await this.analyzeRevenue(events, cohorts);
    const ltv = await this.analyzeLTV(events, cohorts);
    const comparison = await this.compareCohorts(cohorts);

    return {
      cohorts,
      retention,
      revenue,
      ltv,
      comparison,
    };
  }

  /**
   * Build cohorts from events
   */
  async buildCohorts(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<Cohort[]> {
    const cohorts: Cohort[] = [];

    // Build acquisition cohorts (weekly)
    const acquisitionCohorts = this.buildAcquisitionCohorts(events, timeRange);
    cohorts.push(...acquisitionCohorts);

    // Build signup cohorts (monthly)
    const signupCohorts = this.buildSignupCohorts(events, timeRange);
    cohorts.push(...signupCohorts);

    // Build feature cohorts
    const featureCohorts = this.buildFeatureCohorts(events, timeRange);
    cohorts.push(...featureCohorts);

    return cohorts;
  }

  /**
   * Analyze cohort retention
   */
  async analyzeRetention(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): Promise<CohortRetentionAnalysis> {
    const table = this.buildRetentionTable(events, cohorts);
    const curves = this.buildRetentionCurves(events, cohorts);
    const summary = this.calculateRetentionSummary(curves);

    return {
      table,
      curves,
      summary,
    };
  }

  /**
   * Analyze cohort revenue
   */
  async analyzeRevenue(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): Promise<CohortRevenueAnalysis> {
    const cumulative = this.buildCumulativeRevenueCurves(events, cohorts);
    const perPeriod = this.buildPerPeriodRevenueCurves(events, cohorts);
    const bySegment = this.buildRevenueBySegment(events, cohorts);

    return {
      cumulative,
      perPeriod,
      bySegment,
    };
  }

  /**
   * Analyze cohort LTV
   */
  async analyzeLTV(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): Promise<CohortLTVAnalysis> {
    const curves = this.buildLTVCurves(events, cohorts);
    const projections = this.calculateLTVProjections(curves);
    const comparison = this.compareLTV(curves);

    return {
      curves,
      projections,
      comparison,
    };
  }

  /**
   * Compare cohorts
   */
  async compareCohorts(cohorts: Cohort[]): Promise<CohortComparison> {
    const metrics = this.buildComparisonMetrics(cohorts);
    const statistical = this.performStatisticalComparison(cohorts);

    return {
      metrics,
      statistical,
    };
  }

  // ==========================================================================
  // Cohort Building Methods
  // ==========================================================================

  private buildAcquisitionCohorts(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Cohort[] {
    const cohorts: Cohort[] = [];
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    // Group users by acquisition week
    const userAcquisitionWeek = new Map<string, number>();
    for (const event of events) {
      if (event.type === 'signup' && !userAcquisitionWeek.has(event.userId)) {
        const weekIndex = Math.floor((event.timestamp - timeRange.start) / weekMs);
        userAcquisitionWeek.set(event.userId, weekIndex);
      }
    }

    // Create cohorts for each week
    const weekUsers = new Map<number, Set<string>>();
    for (const [userId, weekIndex] of userAcquisitionWeek.entries()) {
      if (!weekUsers.has(weekIndex)) {
        weekUsers.set(weekIndex, new Set());
      }
      weekUsers.get(weekIndex)!.add(userId);
    }

    for (const [weekIndex, users] of weekUsers.entries()) {
      const cohortStart = timeRange.start + weekIndex * weekMs;
      const cohort = this.createCohort(
        `acquisition_week_${weekIndex}`,
        `Acquisition Week ${weekIndex + 1}`,
        'acquisition',
        new Date(cohortStart).toISOString().split('T')[0],
        users.size,
        events,
        users
      );
      cohorts.push(cohort);
    }

    return cohorts;
  }

  private buildSignupCohorts(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Cohort[] {
    const cohorts: Cohort[] = [];
    const monthMs = 30 * 24 * 60 * 60 * 1000;

    // Group users by signup month
    const userSignupMonth = new Map<string, number>();
    for (const event of events) {
      if (event.type === 'signup' && !userSignupMonth.has(event.userId)) {
        const monthIndex = Math.floor((event.timestamp - timeRange.start) / monthMs);
        userSignupMonth.set(event.userId, monthIndex);
      }
    }

    // Create cohorts for each month
    const monthUsers = new Map<number, Set<string>>();
    for (const [userId, monthIndex] of userSignupMonth.entries()) {
      if (!monthUsers.has(monthIndex)) {
        monthUsers.set(monthIndex, new Set());
      }
      monthUsers.get(monthIndex)!.add(userId);
    }

    for (const [monthIndex, users] of monthUsers.entries()) {
      const cohortStart = timeRange.start + monthIndex * monthMs;
      const cohort = this.createCohort(
        `signup_month_${monthIndex}`,
        `Signup Month ${monthIndex + 1}`,
        'signup',
        new Date(cohortStart).toISOString().slice(0, 7),
        users.size,
        events,
        users
      );
      cohorts.push(cohort);
    }

    return cohorts;
  }

  private buildFeatureCohorts(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Cohort[] {
    const cohorts: Cohort[] = [];

    // Group users by first feature used
    const userFeature = new Map<string, string>();
    for (const event of events) {
      if (event.type === 'feature_use' && !userFeature.has(event.userId)) {
        userFeature.set(event.userId, event.properties.feature_id || 'unknown');
      }
    }

    // Create cohorts for each feature
    const featureUsers = new Map<string, Set<string>>();
    for (const [userId, feature] of userFeature.entries()) {
      if (!featureUsers.has(feature)) {
        featureUsers.set(feature, new Set());
      }
      featureUsers.get(feature)!.add(userId);
    }

    for (const [feature, users] of featureUsers.entries()) {
      const cohort = this.createCohort(
        `feature_${feature}`,
        `Feature: ${feature}`,
        'feature',
        feature,
        users.size,
        events,
        users
      );
      cohorts.push(cohort);
    }

    return cohorts;
  }

  private createCohort(
    id: string,
    name: string,
    type: CohortType,
    period: string,
    size: number,
    events: AnalyticsEvent[],
    users: Set<string>
  ): Cohort {
    const cohortEvents = events.filter((e) => users.has(e.userId));
    const revenue = cohortEvents
      .filter((e) => ['purchase', 'subscription'].includes(e.type))
      .reduce((sum, e) => sum + (e.properties.amount || 0), 0);

    const retention = this.calculateCohortRetention(cohortEvents, users);
    const ltv = size > 0 ? revenue / size : 0;

    return {
      id,
      name,
      type,
      period,
      size,
      metrics: {
        day1: retention.day1,
        day7: retention.day7,
        day30: retention.day30,
        day90: retention.day90,
        day180: retention.day180,
        day365: retention.day365,
      },
      retention: retention.curve,
      revenue: this.calculateCohortRevenue(cohortEvents),
      ltv,
    };
  }

  private calculateCohortRetention(
    events: AnalyticsEvent[],
    cohortUsers: Set<string>
  ): { curve: number[]; day1: number; day7: number; day30: number; day90: number; day180: number; day365: number } {
    const cohortStart = Math.min(...events.map((e) => e.timestamp));
    const retention: number[] = [];

    // Calculate retention for each period
    const periods = [1, 7, 30, 90, 180, 365];
    const periodRetention: Record<number, number> = {};

    for (const days of periods) {
      const periodStart = cohortStart + days * 24 * 60 * 60 * 1000;
      const periodEnd = periodStart + 24 * 60 * 60 * 1000;

      const activeUsers = new Set(
        events
          .filter((e) => e.timestamp >= periodStart && e.timestamp < periodEnd)
          .map((e) => e.userId)
      );

      const retained = cohortUsers.intersection(activeUsers);
      const retentionRate = cohortUsers.size > 0 ? (retained.size / cohortUsers.size) * 100 : 0;

      periodRetention[days] = retentionRate;
      retention.push(retentionRate);
    }

    return {
      curve: retention,
      day1: periodRetention[1],
      day7: periodRetention[7],
      day30: periodRetention[30],
      day90: periodRetention[90],
      day180: periodRetention[180],
      day365: periodRetention[365],
    };
  }

  private calculateCohortRevenue(events: AnalyticsEvent[]): number[] {
    const revenueByMonth = new Map<number, number>();

    for (const event of events) {
      if (['purchase', 'subscription'].includes(event.type)) {
        const month = Math.floor(event.timestamp / (30 * 24 * 60 * 60 * 1000));
        const amount = event.properties.amount || 0;
        revenueByMonth.set(month, (revenueByMonth.get(month) || 0) + amount);
      }

      return Array.from(revenueByMonth.values());
    }

    return [];
  }

  // ==========================================================================
  // Retention Analysis Methods
  // ==========================================================================

  private buildRetentionTable(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): RetentionTable {
    const headers = ['Cohort', 'Size', ...Array.from({ length: 12 }, (_, i) => `Day ${[1, 7, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300][i]}`)];
    const rows: RetentionRow[] = [];

    for (const cohort of cohorts) {
      const periods = cohort.retention.slice(0, 12);
      rows.push({
        cohort: cohort.name,
        size: cohort.size,
        periods,
      });
    }

    return { headers, rows };
  }

  private buildRetentionCurves(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): RetentionCurve[] {
    return cohorts.map((cohort) => ({
      cohort: cohort.id,
      curve: cohort.retention,
      prediction: this.predictRetention(cohort.retention),
      confidence: this.calculateConfidenceInterval(cohort.retention),
    }));
  }

  private predictRetention(retention: number[]): number[] {
    // Simple exponential decay prediction
    const prediction: number[] = [...retention];

    for (let i = retention.length; i < 365; i += 30) {
      const lastValue = prediction[prediction.length - 1];
      const decayRate = 0.95;
      prediction.push(lastValue * decayRate);
    }

    return prediction;
  }

  private calculateConfidenceInterval(retention: number[]): number[] {
    const mean = retention.reduce((a, b) => a + b, 0) / retention.length;
    const variance = retention.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / retention.length;
    const std = Math.sqrt(variance);

    return retention.map((val) => 1.96 * std); // 95% confidence
  }

  private calculateRetentionSummary(curves: RetentionCurve[]): RetentionSummary {
    const avgRetention: number[] = [];

    if (curves.length > 0) {
      const maxLength = Math.max(...curves.map((c) => c.curve.length));

      for (let i = 0; i < maxLength; i++) {
        let sum = 0;
        let count = 0;

        for (const curve of curves) {
          if (i < curve.curve.length) {
            sum += curve.curve[i];
            count++;
          }
        }

        avgRetention.push(count > 0 ? sum / count : 0);
      }
    }

    const best = curves.reduce((best, curr) =>
      curr.curve[0] > best.curve[0] ? curr : best
    );

    const worst = curves.reduce((worst, curr) =>
      curr.curve[0] < worst.curve[0] ? curr : worst
    );

    // Determine trend
    const earlyAvg = avgRetention.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(3, avgRetention.length);
    const lateAvg = avgRetention.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, avgRetention.length);
    const trend = lateAvg > earlyAvg * 1.1 ? 'improving' : lateAvg < earlyAvg * 0.9 ? 'declining' : 'stable';

    return {
      average: avgRetention[0] || 0,
      best: { cohort: best.cohort, value: best.curve[0], period: 'day1' },
      worst: { cohort: worst.cohort, value: worst.curve[0], period: 'day1' },
      trend,
    };
  }

  // ==========================================================================
  // Revenue Analysis Methods
  // ==========================================================================

  private buildCumulativeRevenueCurves(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): CohortRevenueCurve[] {
    return cohorts.map((cohort) => {
      const cohortEvents = events.filter((e) => e.userId && cohort.size > 0);

      let cumulative = 0;
      const curve: number[] = cohort.revenue.map((rev) => {
        cumulative += rev;
        return cumulative;
      });

      return {
        cohort: cohort.id,
        curve,
        total: cumulative,
        average: cumulative / Math.max(1, cohort.size),
        median: this.calculateMedian(cohort.revenue),
      };
    });
  }

  private buildPerPeriodRevenueCurves(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): CohortRevenueCurve[] {
    return cohorts.map((cohort) => ({
      cohort: cohort.id,
      curve: cohort.revenue,
      total: cohort.revenue.reduce((a, b) => a + b, 0),
      average: cohort.revenue.reduce((a, b) => a + b, 0) / Math.max(1, cohort.revenue.length),
      median: this.calculateMedian(cohort.revenue),
    }));
  }

  private buildRevenueBySegment(
    events: AnalyticsEvent[],
    cohorts: Cohort[]
  ): Record<string, CohortRevenueCurve[]> {
    const bySegment: Record<string, CohortRevenueCurve[]> = {};

    for (const cohort of cohorts) {
      const segment = cohort.type;
      if (!bySegment[segment]) {
        bySegment[segment] = [];
      }

      bySegment[segment].push({
        cohort: cohort.id,
        curve: cohort.revenue,
        total: cohort.revenue.reduce((a, b) => a + b, 0),
        average: cohort.revenue.reduce((a, b) => a + b, 0) / Math.max(1, cohort.revenue.length),
        median: this.calculateMedian(cohort.revenue),
      });
    }

    return bySegment;
  }

  // ==========================================================================
  // LTV Analysis Methods
  // ==========================================================================

  private buildLTVCurves(events: AnalyticsEvent[], cohorts: Cohort[]): LTVCurve[] {
    return cohorts.map((cohort) => {
      const cumulativeRevenue = this.buildCumulativeRevenueCurves(events, [cohort])[0];
      const cac = 100; // Placeholder - would calculate from acquisition costs
      const paybackPeriod = this.calculatePaybackPeriod(cumulativeRevenue.curve, cac);
      const roi = cac > 0 ? ((cumulativeRevenue.total - cac) / cac) * 100 : 0;

      return {
        cohort: cohort.id,
        ltv: cumulativeRevenue.curve,
        cac,
        paybackPeriod,
        roi,
      };
    });
  }

  private calculatePaybackPeriod(revenueCurve: number[], cac: number): number {
    let cumulative = 0;

    for (let i = 0; i < revenueCurve.length; i++) {
      cumulative += revenueCurve[i];
      if (cumulative >= cac) {
        return i * 30; // Convert to days (assuming monthly data)
      }
    }

    return Infinity;
  }

  private calculateLTVProjections(curves: LTVCurve[]): LTVProjection {
    const avgLTV = curves.reduce((sum, curve) => {
      const totalLTV = curve.ltv[curve.ltv.length - 1] || 0;
      return sum + totalLTV;
    }, 0) / curves.length;

    return {
      month6: avgLTV * 1.5,
      month12: avgLTV * 2,
      month24: avgLTV * 3,
      month36: avgLTV * 4,
      confidence: 0.8,
    };
  }

  private compareLTV(curves: LTVCurve[]): LTVComparison {
    const byCohort: Record<string, number> = {};
    const bySegment: Record<string, number> = {};

    for (const curve of curves) {
      const ltv = curve.ltv[curve.ltv.length - 1] || 0;
      byCohort[curve.cohort] = ltv;
    }

    const avgLTV = Object.values(byCohort).reduce((a, b) => a + b, 0) / Object.values(byCohort).length;
    const trend = 5; // Placeholder - would calculate actual trend

    return {
      byCohort,
      bySegment,
      trend,
    };
  }

  // ==========================================================================
  // Comparison Methods
  // ==========================================================================

  private buildComparisonMetrics(cohorts: Cohort[]): ComparisonMetric[] {
    const metrics: ComparisonMetric[] = [];

    const metricNames = ['day1', 'day7', 'day30', 'ltv'];
    for (const metricName of metricNames) {
      const cohortValues: Record<string, number> = {};

      for (const cohort of cohorts) {
        const value = metricName === 'ltv' ? cohort.ltv : cohort.metrics[metricName as keyof CohortMetrics] as number;
        cohortValues[cohort.id] = value;
      }

      const values = Object.values(cohortValues);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);
      const difference = max - min;

      metrics.push({
        metric: metricName,
        cohorts: cohortValues,
        difference,
        significant: difference > avg * 0.2,
      });
    }

    return metrics;
  }

  private performStatisticalComparison(cohorts: Cohort[]): StatisticalComparison {
    // Simplified t-test between first two cohorts
    if (cohorts.length < 2) {
      return {
        test: 'insufficient_data',
        statistic: 0,
        pValue: 1,
        significant: false,
        recommendation: 'Need at least 2 cohorts for comparison',
      };
    }

    const cohort1Retention = cohorts[0].retention[0];
    const cohort2Retention = cohorts[1].retention[0];

    const statistic = Math.abs(cohort1Retention - cohort2Retention);
    const pValue = 0.05; // Placeholder - would perform actual statistical test
    const significant = statistic > 10;

    return {
      test: 't_test',
      statistic,
      pValue,
      significant,
      recommendation: significant
        ? `${cohorts[0].name} significantly outperforms ${cohorts[1].name}`
        : 'No significant difference between cohorts',
    };
  }

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}
