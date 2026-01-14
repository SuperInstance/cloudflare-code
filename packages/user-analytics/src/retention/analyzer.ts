/**
 * Retention Analyzer
 * Comprehensive retention analysis with cohort tracking and churn prediction
 */

import type {
  RetentionAnalysis,
  RetentionCurve,
  RetentionDataPoint,
  RetentionPeriod,
  RetentionSummary,
  BestCohort,
  WorstCohort,
  CohortType,
  PeriodType,
  RetentionBreakdown,
  RetentionSegment,
  ChurnPrediction,
  ChurnFactor,
  SurvivalAnalysis,
  SurvivalDataPoint,
  User,
  AnalyticsEvent,
  DateRange,
  Cohort,
} from '../types/index.js';

// ============================================================================
// Cohort Creator
// ============================================================================

export class CohortCreator {
  /**
   * Create cohorts based on acquisition date
   */
  createAcquisitionCohorts(
    users: User[],
    periodType: PeriodType
  ): Cohort[] {
    const cohorts = new Map<string, User[]>();

    for (const user of users) {
      const cohortPeriod = this.getPeriod(user.createdAt, periodType);

      if (!cohorts.has(cohortPeriod)) {
        cohorts.set(cohortPeriod, []);
      }

      cohorts.get(cohortPeriod)!.push(user);
    }

    return Array.from(cohorts.entries()).map(([period, cohortUsers]) => ({
      id: `cohort_acquisition_${period}`,
      name: `Acquisition - ${period}`,
      type: 'acquisition',
      definition: {
        criteria: {
          type: 'first_seen',
          dateRange: this.getPeriodDateRange(period, periodType),
        },
        timeWindow: {
          value: 1,
          unit: periodType,
        },
      },
      users: cohortUsers.map((u) => ({
        userId: u.id,
        cohortEntryDate: u.createdAt,
        properties: u.properties,
        active: true,
      })),
      size: cohortUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Create cohorts based on activation
   */
  createActivationCohorts(
    users: User[],
    events: AnalyticsEvent[],
    periodType: PeriodType
  ): Cohort[] {
    const activationEvents = this.getActivationEvents(events);
    const cohorts = new Map<string, Array<{ userId: string; date: number }>>();

    for (const event of activationEvents) {
      if (!event.userId) continue;

      const cohortPeriod = this.getPeriod(event.timestamp, periodType);

      if (!cohorts.has(cohortPeriod)) {
        cohorts.set(cohortPeriod, []);
      }

      cohorts.get(cohortPeriod)!.push({
        userId: event.userId,
        date: event.timestamp,
      });
    }

    return Array.from(cohorts.entries()).map(([period, activations]) => ({
      id: `cohort_activation_${period}`,
      name: `Activation - ${period}`,
      type: 'activation',
      definition: {
        criteria: {
          type: 'event',
          eventType: 'activation',
          eventName: 'user_activated',
        },
        timeWindow: {
          value: 1,
          unit: periodType,
        },
      },
      users: activations.map((a) => ({
        userId: a.userId,
        cohortEntryDate: a.date,
        active: true,
      })),
      size: activations.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));
  }

  /**
   * Create cohorts based on behavior
   */
  createBehaviorCohorts(
    users: User[],
    events: AnalyticsEvent[],
    behaviorType: string
  ): Cohort[] {
    const userBehaviors = this.analyzeUserBehaviors(events, behaviorType);

    // Group users by behavior intensity
    const high = users.filter((u) => (userBehaviors.get(u.id) || 0) > 10);
    const medium = users.filter(
      (u) => {
        const count = userBehaviors.get(u.id) || 0;
        return count > 3 && count <= 10;
      }
    );
    const low = users.filter((u) => (userBehaviors.get(u.id) || 0) <= 3);

    const cohorts: Cohort[] = [];

    if (high.length > 0) {
      cohorts.push({
        id: `cohort_behavior_${behaviorType}_high`,
        name: `${behaviorType} - High`,
        type: 'behavior',
        definition: {
          criteria: {
            type: 'behavior',
            behaviorType,
            behaviorThreshold: 10,
          },
        },
        users: high.map((u) => ({
          userId: u.id,
          cohortEntryDate: u.createdAt,
          properties: u.properties,
          active: true,
        })),
        size: high.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    if (medium.length > 0) {
      cohorts.push({
        id: `cohort_behavior_${behaviorType}_medium`,
        name: `${behaviorType} - Medium`,
        type: 'behavior',
        definition: {
          criteria: {
            type: 'behavior',
            behaviorType,
            behaviorThreshold: 3,
          },
        },
        users: medium.map((u) => ({
          userId: u.id,
          cohortEntryDate: u.createdAt,
          properties: u.properties,
          active: true,
        })),
        size: medium.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    if (low.length > 0) {
      cohorts.push({
        id: `cohort_behavior_${behaviorType}_low`,
        name: `${behaviorType} - Low`,
        type: 'behavior',
        definition: {
          criteria: {
            type: 'behavior',
            behaviorType,
            behaviorThreshold: 0,
          },
        },
        users: low.map((u) => ({
          userId: u.id,
          cohortEntryDate: u.createdAt,
          properties: u.properties,
          active: true,
        })),
        size: low.length,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return cohorts;
  }

  /**
   * Get activation events
   */
  private getActivationEvents(events: AnalyticsEvent[]): AnalyticsEvent[] {
    return events.filter(
      (e) => e.eventName === 'user_activated' || e.eventName === 'activation'
    );
  }

  /**
   * Analyze user behaviors
   */
  private analyzeUserBehaviors(
    events: AnalyticsEvent[],
    behaviorType: string
  ): Map<string, number> {
    const behaviors = new Map<string, number>();

    for (const event of events) {
      if (!event.userId) continue;

      const current = behaviors.get(event.userId) || 0;
      behaviors.set(event.userId, current + 1);
    }

    return behaviors;
  }

  /**
   * Get period for a timestamp
   */
  private getPeriod(timestamp: number, periodType: PeriodType): string {
    const date = new Date(timestamp);

    switch (periodType) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'quarterly':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `${date.getFullYear()}-Q${quarter}`;
    }
  }

  /**
   * Get date range for a period
   */
  private getPeriodDateRange(
    period: string,
    periodType: PeriodType
  ): DateRange {
    // Parse period and return appropriate date range
    // This is a simplified implementation
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    switch (periodType) {
      case 'daily':
        return {
          start: now - 30 * dayInMs,
          end: now,
        };
      case 'weekly':
        return {
          start: now - 12 * 7 * dayInMs,
          end: now,
        };
      case 'monthly':
        return {
          start: now - 12 * 30 * dayInMs,
          end: now,
        };
      case 'quarterly':
        return {
          start: now - 4 * 90 * dayInMs,
          end: now,
        };
    }
  }
}

// ============================================================================
// Retention Calculator
// ============================================================================

export class RetentionCalculator {
  /**
   * Calculate retention for cohorts
   */
  calculateRetention(
    cohorts: Cohort[],
    events: AnalyticsEvent[],
    periodType: PeriodType
  ): RetentionCurve {
    const data: RetentionDataPoint[] = [];
    const periodLength = this.getPeriodLength(periodType);

    for (const cohort of cohorts) {
      const cohortPeriod = this.getCohortPeriod(cohort, periodType);
      const periods: RetentionPeriod[] = [];

      for (let periodOffset = 0; periodOffset < 12; periodOffset++) {
        const periodStart = cohort.users[0]?.cohortEntryDate || 0;
        const periodEnd = periodStart + (periodOffset + 1) * periodLength;

        const retainedUsers = this.getRetainedUsers(
          cohort,
          events,
          periodStart,
          periodEnd
        );

        periods.push({
          period: periodOffset + 1,
          retained: retainedUsers.length,
          percentage:
            cohort.size > 0 ? (retainedUsers.length / cohort.size) * 100 : 0,
          returningUsers: retainedUsers,
        });
      }

      data.push({
        cohort: cohort.name,
        cohortPeriod,
        cohortSize: cohort.size,
        periods,
      });
    }

    // Calculate averages
    const averages = this.calculateAverageRetention(data);

    // Find best and worst cohorts
    const bestCohort = this.findBestCohort(data);
    const worstCohort = this.findWorstCohort(data);

    return {
      data,
      averages,
      bestCohort,
      worstCohort,
    };
  }

  /**
   * Calculate retention summary
   */
  calculateSummary(curve: RetentionCurve): RetentionSummary {
    const day1Retention = curve.averages[0] || 0;
    const day7Retention = curve.averages[6] || 0;
    const day30Retention = curve.averages[29] || 0;

    const avgRetention =
      curve.averages.length > 0
        ? curve.averages.reduce((a, b) => a + b, 0) / curve.averages.length
        : 0;

    const medianRetention = this.calculateMedian(curve.averages);

    // Calculate churn rate (complement of retention)
    const churnRate = 100 - avgRetention;

    // Estimate median lifetime
    const medianLifetime = this.estimateMedianLifetime(curve);

    return {
      overallRetention: curve.averages,
      day1Retention,
      day7Retention,
      day30Retention,
      avgRetention,
      medianRetention,
      churnRate,
      medianLifetime,
    };
  }

  /**
   * Get retained users for a period
   */
  private getRetainedUsers(
    cohort: Cohort,
    events: AnalyticsEvent[],
    periodStart: number,
    periodEnd: number
  ): string[] {
    const retained: string[] = [];

    for (const user of cohort.users) {
      const userEvents = events.filter(
        (e) =>
          e.userId === user.userId &&
          e.timestamp >= periodStart &&
          e.timestamp < periodEnd
      );

      if (userEvents.length > 0) {
        retained.push(user.userId);
      }
    }

    return retained;
  }

  /**
   * Get period for cohort
   */
  private getCohortPeriod(cohort: Cohort, periodType: PeriodType): string {
    const firstUser = cohort.users[0];
    if (!firstUser) return 'unknown';

    return new Date(firstUser.cohortEntryDate).toISOString().split('T')[0];
  }

  /**
   * Get period length in milliseconds
   */
  private getPeriodLength(periodType: PeriodType): number {
    switch (periodType) {
      case 'daily':
        return 24 * 60 * 60 * 1000;
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000;
      case 'quarterly':
        return 90 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Calculate average retention across all cohorts
   */
  private calculateAverageRetention(data: RetentionDataPoint[]): number[] {
    const maxPeriods = Math.max(...data.map((d) => d.periods.length));
    const averages: number[] = [];

    for (let i = 0; i < maxPeriods; i++) {
      const values = data
        .map((d) => d.periods[i]?.percentage || 0)
        .filter((v) => v > 0);

      const avg =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

      averages.push(avg);
    }

    return averages;
  }

  /**
   * Find best performing cohort
   */
  private findBestCohort(data: RetentionDataPoint[]): BestCohort | undefined {
    if (data.length === 0) return undefined;

    const avgRetentions = data.map((d) => ({
      cohort: d.cohort,
      retentionRates: d.periods.map((p) => p.percentage),
      avgRetention:
        d.periods.reduce((sum, p) => sum + p.percentage, 0) / d.periods.length,
    }));

    const best = avgRetentions.sort((a, b) => b.avgRetention - a.avgRetention)[0];

    return {
      cohort: best.cohort,
      retentionRates: best.retentionRates,
      avgRetention: best.avgRetention,
    };
  }

  /**
   * Find worst performing cohort
   */
  private findWorstCohort(data: RetentionDataPoint[]): WorstCohort | undefined {
    if (data.length === 0) return undefined;

    const avgRetentions = data.map((d) => ({
      cohort: d.cohort,
      retentionRates: d.periods.map((p) => p.percentage),
      avgRetention:
        d.periods.reduce((sum, p) => sum + p.percentage, 0) / d.periods.length,
    }));

    const worst = avgRetentions.sort((a, b) => a.avgRetention - b.avgRetention)[0];

    return {
      cohort: worst.cohort,
      retentionRates: worst.retentionRates,
      avgRetention: worst.avgRetention,
    };
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Estimate median lifetime
   */
  private estimateMedianLifetime(curve: RetentionCurve): number {
    // Find the period where retention drops below 50%
    for (let i = 0; i < curve.averages.length; i++) {
      if (curve.averages[i] < 50) {
        return i + 1; // Return period number
      }
    }

    return curve.averages.length;
  }
}

// ============================================================================
// Retention Analyzer
// ============================================================================

export class RetentionAnalyzer {
  private cohortCreator: CohortCreator;
  private retentionCalculator: RetentionCalculator;

  constructor() {
    this.cohortCreator = new CohortCreator();
    this.retentionCalculator = new RetentionCalculator();
  }

  /**
   * Perform comprehensive retention analysis
   */
  analyze(
    users: User[],
    events: AnalyticsEvent[],
    cohortType: CohortType = 'acquisition',
    periodType: PeriodType = 'daily',
    dateRange?: DateRange
  ): RetentionAnalysis {
    // Filter events by date range
    const filteredEvents = dateRange
      ? events.filter((e) => e.timestamp >= dateRange.start && e.timestamp <= dateRange.end)
      : events;

    // Create cohorts
    const cohorts =
      cohortType === 'acquisition'
        ? this.cohortCreator.createAcquisitionCohorts(users, periodType)
        : cohortType === 'activation'
        ? this.cohortCreator.createActivationCohorts(users, filteredEvents, periodType)
        : this.cohortCreator.createBehaviorCohorts(users, filteredEvents, 'engagement');

    // Calculate retention curve
    const retentionCurve = this.retentionCalculator.calculateRetention(
      cohorts,
      filteredEvents,
      periodType
    );

    // Calculate summary
    const summary = this.retentionCalculator.calculateSummary(retentionCurve);

    return {
      id: `retention_analysis_${Date.now()}`,
      name: `${cohortType} Retention Analysis`,
      cohortType,
      periodType,
      retentionCurve,
      summary,
      generatedAt: Date.now(),
      dateRange: dateRange || {
        start: Math.min(...users.map((u) => u.createdAt)),
        end: Date.now(),
      },
    };
  }

  /**
   * Analyze retention with breakdown
   */
  analyzeWithBreakdown(
    users: User[],
    events: AnalyticsEvent[],
    breakdownDimension: string,
    cohortType: CohortType = 'acquisition',
    periodType: PeriodType = 'daily'
  ): RetentionAnalysis & { breakdown: RetentionBreakdown } {
    // Get unique values for breakdown
    const dimensionValues = this.getDimensionValues(users, breakdownDimension);

    const segments: RetentionSegment[] = dimensionValues.map((value) => {
      const segmentUsers = users.filter(
        (u) => this.getUserDimension(u, breakdownDimension) === value
      );

      const analysis = this.analyze(segmentUsers, events, cohortType, periodType);

      return {
        name: breakdownDimension,
        value: String(value),
        retentionCurve: analysis.retentionCurve,
        summary: analysis.summary,
      };
    });

    const baseAnalysis = this.analyze(users, events, cohortType, periodType);

    return {
      ...baseAnalysis,
      breakdown: {
        byDimension: breakdownDimension,
        segments,
      },
    };
  }

  /**
   * Get dimension values from users
   */
  private getDimensionValues(users: User[], dimension: string): string[] {
    const values = new Set<string>();

    for (const user of users) {
      const value = this.getUserDimension(user, dimension);
      if (value !== undefined) {
        values.add(String(value));
      }
    }

    return Array.from(values);
  }

  /**
   * Get dimension value from user
   */
  private getUserDimension(user: User, dimension: string): unknown {
    if (dimension.startsWith('properties.')) {
      const key = dimension.replace('properties.', '');
      return user.properties[key];
    }

    return (user as any)[dimension];
  }
}

// ============================================================================
// Churn Predictor
// ============================================================================

export class ChurnPredictor {
  /**
   * Predict churn for users
   */
  predictChurn(users: User[], events: AnalyticsEvent[]): ChurnPrediction[] {
    const predictions: ChurnPrediction[] = [];

    for (const user of users) {
      const prediction = this.predictUserChurn(user, events);
      predictions.push(prediction);
    }

    return predictions.sort((a, b) => b.churnProbability - a.churnProbability);
  }

  /**
   * Predict churn for a single user
   */
  predictUserChurn(user: User, events: AnalyticsEvent[]): ChurnPrediction {
    const userEvents = events.filter((e) => e.userId === user.id);

    const factors = this.calculateChurnFactors(user, userEvents);
    const churnProbability = this.calculateChurnProbability(factors);
    const churnRisk = this.getChurnRisk(churnProbability);

    return {
      userId: user.id,
      churnProbability,
      churnRisk,
      factors,
      predictedChurnDate: this.predictChurnDate(user, churnProbability),
      suggestedActions: this.getSuggestedActions(factors),
      generatedAt: Date.now(),
    };
  }

  /**
   * Calculate churn factors
   */
  private calculateChurnFactors(user: User, events: AnalyticsEvent[]): ChurnFactor[] {
    const factors: ChurnFactor[] = [];
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Activity level factor
    const recentEvents = events.filter((e) => e.timestamp >= thirtyDaysAgo);
    const activityScore = recentEvents.length / 30; // Events per day

    factors.push({
      factor: 'Activity Level',
      impact: activityScore < 1 ? 0.3 : activityScore < 5 ? 0.1 : -0.1,
      description: 'Recent user activity',
      currentValue: activityScore,
      typicalValue: 5,
    });

    // Last activity factor
    const lastEvent = events.sort((a, b) => b.timestamp - a.timestamp)[0];
    const daysSinceLastActivity = lastEvent
      ? (now - lastEvent.timestamp) / (24 * 60 * 60 * 1000)
      : 30;

    factors.push({
      factor: 'Days Since Last Activity',
      impact: daysSinceLastActivity > 14 ? 0.4 : daysSinceLastActivity > 7 ? 0.2 : 0,
      description: 'Time since last user activity',
      currentValue: daysSinceLastActivity,
      typicalValue: 2,
    });

    // Engagement trend factor
    const engagementTrend = this.calculateEngagementTrend(events);
    factors.push({
      factor: 'Engagement Trend',
      impact: engagementTrend < -0.5 ? 0.3 : engagementTrend < -0.2 ? 0.1 : 0,
      description: 'Change in engagement over time',
      currentValue: engagementTrend,
      typicalValue: 0,
    });

    // Session consistency factor
    const sessionConsistency = this.calculateSessionConsistency(events);
    factors.push({
      factor: 'Session Consistency',
      impact: sessionConsistency < 0.3 ? 0.2 : 0,
      description: 'Regularity of user sessions',
      currentValue: sessionConsistency,
      typicalValue: 0.7,
    });

    // Feature adoption factor
    const featureAdoption = this.calculateFeatureAdoption(events);
    factors.push({
      factor: 'Feature Adoption',
      impact: featureAdoption < 2 ? 0.15 : 0,
      description: 'Number of features used',
      currentValue: featureAdoption,
      typicalValue: 3,
    });

    return factors;
  }

  /**
   * Calculate churn probability from factors
   */
  private calculateChurnProbability(factors: ChurnFactor[]): number {
    let probability = 0;

    for (const factor of factors) {
      if (factor.impact > 0) {
        probability += factor.impact;
      }
    }

    return Math.min(probability, 1);
  }

  /**
   * Get churn risk level
   */
  private getChurnRisk(probability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (probability >= 0.7) return 'critical';
    if (probability >= 0.5) return 'high';
    if (probability >= 0.3) return 'medium';
    return 'low';
  }

  /**
   * Predict churn date
   */
  private predictChurnDate(user: User, probability: number): number | undefined {
    if (probability < 0.5) return undefined;

    const daysUntilChurn = Math.floor((1 - probability) * 60);
    return Date.now() + daysUntilChurn * 24 * 60 * 60 * 1000;
  }

  /**
   * Get suggested actions to prevent churn
   */
  private getSuggestedActions(factors: ChurnFactor[]): string[] {
    const actions: string[] = [];

    for (const factor of factors) {
      if (factor.impact >= 0.3) {
        switch (factor.factor) {
          case 'Activity Level':
            actions.push('Send re-engagement email campaign');
            actions.push('Offer personalized content recommendations');
            break;
          case 'Days Since Last Activity':
            actions.push('Send win-back email with special offer');
            actions.push('Reach out with personalized message');
            break;
          case 'Engagement Trend':
            actions.push('Survey user to understand declining engagement');
            actions.push('Offer new features or training');
            break;
          case 'Session Consistency':
            actions.push('Create habit-forming features');
            actions.push('Send regular engagement reminders');
            break;
          case 'Feature Adoption':
            actions.push('Provide feature tutorials and guides');
            actions.push('Highlight underutilized features');
            break;
        }
      }
    }

    return actions.slice(0, 5); // Limit to 5 actions
  }

  /**
   * Calculate engagement trend
   */
  private calculateEngagementTrend(events: AnalyticsEvent[]): number {
    const now = Date.now();
    const weekInMs = 7 * 24 * 60 * 60 * 1000;

    const lastWeek = events.filter((e) => e.timestamp >= now - weekInMs).length;
    const previousWeek = events.filter(
      (e) => e.timestamp >= now - 2 * weekInMs && e.timestamp < now - weekInMs
    ).length;

    if (previousWeek === 0) return 0;

    return (lastWeek - previousWeek) / previousWeek;
  }

  /**
   * Calculate session consistency
   */
  private calculateSessionConsistency(events: AnalyticsEvent[]): number {
    const sessions = new Set(events.map((e) => e.sessionId));
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const recentEvents = events.filter((e) => e.timestamp >= thirtyDaysAgo);
    const activeDays = new Set(
      recentEvents.map((e) => new Date(e.timestamp).toDateString())
    ).size;

    return activeDays / 30;
  }

  /**
   * Calculate feature adoption
   */
  private calculateFeatureAdoption(events: AnalyticsEvent[]): number {
    const uniqueEvents = new Set(events.map((e) => e.eventName));
    return uniqueEvents.size;
  }
}

// ============================================================================
// Survival Analyzer
// ============================================================================

export class SurvivalAnalyzer {
  /**
   * Perform survival analysis
   */
  analyze(users: User[], events: AnalyticsEvent[]): SurvivalAnalysis {
    const now = Date.now();
    const survivalCurve: SurvivalDataPoint[] = [];

    // Sort users by creation date
    const sortedUsers = [...users].sort((a, b) => a.createdAt - b.createdAt);

    // Calculate survival at each time point
    const maxTime = Math.max(
      ...users.map((u) => now - u.createdAt)
    );
    const bucketSize = 24 * 60 * 60 * 1000; // 1 day

    for (let t = 0; t <= maxTime; t += bucketSize) {
      const atRisk = sortedUsers.filter(
        (u) => now - u.createdAt >= t
      ).length;

      const eventsInBucket = events.filter(
        (e) => {
          const userAge = now - (e.userId ? sortedUsers.find((u) => u.id === e.userId)?.createdAt || 0 : 0);
          return userAge >= t && userAge < t + bucketSize;
        }
      ).length;

      const churnedInBucket = this.calculateChurnedInBucket(
        sortedUsers,
        events,
        t,
        t + bucketSize,
        now
      );

      // Calculate survival using Kaplan-Meier estimator
      const survival =
        atRisk > 0
          ? ((atRisk - churnedInBucket) / atRisk) *
            (survivalCurve.length > 0 ? survivalCurve[survivalCurve.length - 1].survival : 1)
          : survivalCurve.length > 0
          ? survivalCurve[survivalCurve.length - 1].survival
          : 1;

      survivalCurve.push({
        time: t / bucketSize, // Days
        survival,
        atRisk,
        events: eventsInBucket,
        censored: atRisk - eventsInBucket,
      });
    }

    // Calculate median survival
    const medianSurvival = this.calculateMedianSurvival(survivalCurve);

    // Calculate average survival
    const avgSurvival = this.calculateAverageSurvival(survivalCurve);

    // Calculate percentiles
    const percentiles = this.calculatePercentiles(survivalCurve);

    return {
      survivalCurve,
      medianSurvival,
      avgSurvival,
      percentiles,
      generatedAt: Date.now(),
    };
  }

  /**
   * Calculate churned users in a time bucket
   */
  private calculateChurnedInBucket(
    users: User[],
    events: AnalyticsEvent[],
    startTime: number,
    endTime: number,
    now: number
  ): number {
    let churned = 0;

    for (const user of users) {
      const userAge = now - user.createdAt;

      if (userAge >= startTime && userAge < endTime) {
        // Check if user was active in this period
        const userEvents = events.filter(
          (e) =>
            e.userId === user.id &&
            e.timestamp >= startTime &&
            e.timestamp < endTime
        );

        if (userEvents.length === 0) {
          churned++;
        }
      }
    }

    return churned;
  }

  /**
   * Calculate median survival time
   */
  private calculateMedianSurvival(curve: SurvivalDataPoint[]): number {
    for (const point of curve) {
      if (point.survival <= 0.5) {
        return point.time;
      }
    }

    return curve.length > 0 ? curve[curve.length - 1].time : 0;
  }

  /**
   * Calculate average survival time
   */
  private calculateAverageSurvival(curve: SurvivalDataPoint[]): number {
    if (curve.length === 0) return 0;

    const area = curve.reduce((sum, point, index) => {
      if (index === 0) return 0;
      const prevPoint = curve[index - 1];
      const width = point.time - prevPoint.time;
      const avgHeight = (point.survival + prevPoint.survival) / 2;
      return sum + width * avgHeight;
    }, 0);

    return area;
  }

  /**
   * Calculate survival percentiles
   */
  private calculatePercentiles(curve: SurvivalDataPoint[]): Record<number, number> {
    const percentiles: Record<number, number> = {};

    for (const p of [25, 50, 75, 90]) {
      for (const point of curve) {
        if (point.survival <= (100 - p) / 100) {
          percentiles[p] = point.time;
          break;
        }
      }
    }

    return percentiles;
  }
}
