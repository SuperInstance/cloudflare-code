/**
 * Cohort Analysis
 * Advanced cohort creation, analysis, and comparison
 */

import type {
  Cohort,
  CohortType,
  CohortDefinition,
  CohortCriteria,
  CohortUser,
  CohortMetadata,
  CohortComparison,
  CohortMetric,
  ComparisonDifference,
  User,
  AnalyticsEvent,
  DateRange,
} from '../types/index.js';

// ============================================================================
// Cohort Manager
// ============================================================================

export class CohortManager {
  private cohorts: Map<string, Cohort>;
  private idCounter = 0;

  constructor() {
    this.cohorts = new Map();
  }

  /**
   * Create a new cohort
   */
  createCohort(
    name: string,
    type: CohortType,
    definition: CohortDefinition,
    metadata?: Partial<CohortMetadata>
  ): Cohort {
    const id = `cohort_${++this.idCounter}_${Date.now()}`;
    const now = Date.now();

    const cohort: Cohort = {
      id,
      name,
      type,
      definition,
      users: [],
      size: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {
        description: metadata?.description,
        category: metadata?.category,
        tags: metadata?.tags || [],
        color: metadata?.color,
        public: metadata?.public || false,
        lookalike: metadata?.lookalike || false,
      },
    };

    this.cohorts.set(id, cohort);
    return cohort;
  }

  /**
   * Get a cohort by ID
   */
  getCohort(cohortId: string): Cohort | undefined {
    return this.cohorts.get(cohortId);
  }

  /**
   * Get all cohorts
   */
  getAllCohorts(): Cohort[] {
    return Array.from(this.cohorts.values());
  }

  /**
   * Get cohorts by type
   */
  getCohortsByType(type: CohortType): Cohort[] {
    return Array.from(this.cohorts.values()).filter((c) => c.type === type);
  }

  /**
   * Update a cohort
   */
  updateCohort(cohortId: string, updates: Partial<Cohort>): Cohort | null {
    const cohort = this.cohorts.get(cohortId);

    if (!cohort) return null;

    const updated = {
      ...cohort,
      ...updates,
      id: cohortId,
      updatedAt: Date.now(),
    };

    this.cohorts.set(cohortId, updated);
    return updated;
  }

  /**
   * Delete a cohort
   */
  deleteCohort(cohortId: string): boolean {
    return this.cohorts.delete(cohortId);
  }

  /**
   * Add users to a cohort
   */
  addUsersToCohort(cohortId: string, users: CohortUser[]): boolean {
    const cohort = this.cohorts.get(cohortId);

    if (!cohort) return false;

    // Add new users (avoid duplicates)
    const existingUserIds = new Set(cohort.users.map((u) => u.userId));

    for (const user of users) {
      if (!existingUserIds.has(user.userId)) {
        cohort.users.push(user);
        existingUserIds.add(user.userId);
      }
    }

    cohort.size = cohort.users.length;
    cohort.updatedAt = Date.now();

    return true;
  }

  /**
   * Remove users from a cohort
   */
  removeUsersFromCohort(cohortId: string, userIds: string[]): boolean {
    const cohort = this.cohorts.get(cohortId);

    if (!cohort) return false;

    cohort.users = cohort.users.filter((u) => !userIds.includes(u.userId));
    cohort.size = cohort.users.length;
    cohort.updatedAt = Date.now();

    return true;
  }

  /**
   * Get cohort statistics
   */
  getCohortStats(cohortId: string): CohortStats | null {
    const cohort = this.cohorts.get(cohortId);

    if (!cohort) return null;

    const activeUsers = cohort.users.filter((u) => u.active).length;
    const inactiveUsers = cohort.users.length - activeUsers;

    return {
      id: cohort.id,
      name: cohort.name,
      type: cohort.type,
      size: cohort.size,
      activeUsers,
      inactiveUsers,
      createdAt: cohort.createdAt,
      updatedAt: cohort.updatedAt,
    };
  }

  /**
   * Find similar cohorts
   */
  findSimilarCohorts(cohortId: string, limit = 5): Cohort[] {
    const target = this.cohorts.get(cohortId);

    if (!target) return [];

    const similarities: Array<{ cohort: Cohort; similarity: number }> = [];

    for (const cohort of this.cohorts.values()) {
      if (cohort.id === cohortId) continue;

      const similarity = this.calculateCohortSimilarity(target, cohort);
      similarities.push({ cohort, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((s) => s.cohort);
  }

  /**
   * Calculate similarity between cohorts
   */
  private calculateCohortSimilarity(c1: Cohort, c2: Cohort): number {
    // Jaccard similarity based on user overlap
    const users1 = new Set(c1.users.map((u) => u.userId));
    const users2 = new Set(c2.users.map((u) => u.userId));

    const intersection = new Set([...users1].filter((u) => users2.has(u)));
    const union = new Set([...users1, ...users2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}

interface CohortStats {
  id: string;
  name: string;
  type: CohortType;
  size: number;
  activeUsers: number;
  inactiveUsers: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Cohort Builder
// ============================================================================

export class CohortBuilder {
  /**
   * Build an acquisition cohort
   */
  buildAcquisitionCohort(
    name: string,
    dateRange: DateRange,
    users: User[]
  ): Cohort {
    const cohortUsers = users
      .filter((u) => u.createdAt >= dateRange.start && u.createdAt <= dateRange.end)
      .map((u) => ({
        userId: u.id,
        cohortEntryDate: u.createdAt,
        properties: u.properties,
        active: true,
      }));

    return {
      id: `cohort_acq_${Date.now()}`,
      name,
      type: 'acquisition',
      definition: {
        criteria: {
          type: 'first_seen',
          dateRange,
        },
      },
      users: cohortUsers,
      size: cohortUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Build a behavioral cohort
   */
  buildBehavioralCohort(
    name: string,
    behaviorType: string,
    behaviorThreshold: number,
    events: AnalyticsEvent[],
    users: User[]
  ): Cohort {
    const userBehaviorCounts = new Map<string, number>();

    for (const event of events) {
      if (!event.userId) continue;

      userBehaviorCounts.set(
        event.userId,
        (userBehaviorCounts.get(event.userId) || 0) + 1
      );
    }

    const cohortUsers = users
      .filter((u) => (userBehaviorCounts.get(u.id) || 0) >= behaviorThreshold)
      .map((u) => ({
        userId: u.id,
        cohortEntryDate: u.createdAt,
        properties: u.properties,
        active: true,
      }));

    return {
      id: `cohort_beh_${Date.now()}`,
      name,
      type: 'behavior',
      definition: {
        criteria: {
          type: 'behavior',
          behaviorType,
          behaviorThreshold,
        },
      },
      users: cohortUsers,
      size: cohortUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Build a custom cohort
   */
  buildCustomCohort(
    name: string,
    userFilter: (user: User) => boolean,
    users: User[]
  ): Cohort {
    const cohortUsers = users
      .filter(userFilter)
      .map((u) => ({
        userId: u.id,
        cohortEntryDate: u.createdAt,
        properties: u.properties,
        active: true,
      }));

    return {
      id: `cohort_custom_${Date.now()}`,
      name,
      type: 'custom',
      definition: {
        criteria: {
          type: 'custom',
        },
      },
      users: cohortUsers,
      size: cohortUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Build cohorts from date slices
   */
  buildDateSlicedCohorts(
    namePrefix: string,
    startDate: number,
    endDate: number,
    sliceDays: number,
    users: User[]
  ): Cohort[] {
    const cohorts: Cohort[] = [];
    const sliceMs = sliceDays * 24 * 60 * 60 * 1000;

    for (let start = startDate; start < endDate; start += sliceMs) {
      const end = Math.min(start + sliceMs, endDate);

      const cohortUsers = users
        .filter((u) => u.createdAt >= start && u.createdAt < end)
        .map((u) => ({
          userId: u.id,
          cohortEntryDate: u.createdAt,
          properties: u.properties,
          active: true,
        }));

      if (cohortUsers.length > 0) {
        cohorts.push({
          id: `cohort_slice_${Date.now()}_${start}`,
          name: `${namePrefix} - ${new Date(start).toISOString().split('T')[0]}`,
          type: 'acquisition',
          definition: {
            criteria: {
              type: 'first_seen',
              dateRange: { start, end },
            },
          },
          users: cohortUsers,
          size: cohortUsers.length,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    return cohorts;
  }
}

// ============================================================================
// Cohort Analyzer
// ============================================================================>

export class CohortAnalyzer {
  /**
   * Analyze cohort metrics
   */
  analyzeCohortMetrics(
    cohort: Cohort,
    events: AnalyticsEvent[],
    metrics: string[]
  ): CohortMetric[] {
    const results: CohortMetric[] = [];

    for (const metric of metrics) {
      const value = this.calculateMetric(cohort, events, metric);
      results.push({
        name: metric,
        cohortId: cohort.id,
        value,
      });
    }

    return results;
  }

  /**
   * Calculate a specific metric for a cohort
   */
  private calculateMetric(
    cohort: Cohort,
    events: AnalyticsEvent[],
    metric: string
  ): number {
    const cohortUserIds = new Set(cohort.users.map((u) => u.userId));

    switch (metric) {
      case 'total_events':
        return events.filter((e) => e.userId && cohortUserIds.has(e.userId)).length;

      case 'avg_events_per_user':
        const userEvents = events.filter((e) => e.userId && cohortUserIds.has(e.userId));
        return cohort.size > 0 ? userEvents.length / cohort.size : 0;

      case 'conversion_rate':
        const conversions = events.filter(
          (e) => e.userId && cohortUserIds.has(e.userId) && e.eventType === 'conversion'
        ).length;
        return cohort.size > 0 ? (conversions / cohort.size) * 100 : 0;

      case 'retention_rate':
        // Simplified retention (users active in last 7 days)
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const activeUsers = events.filter(
          (e) =>
            e.userId &&
            cohortUserIds.has(e.userId) &&
            e.timestamp >= sevenDaysAgo
        );
        const uniqueActive = new Set(activeUsers.map((e) => e.userId)).size;
        return cohort.size > 0 ? (uniqueActive / cohort.size) * 100 : 0;

      case 'avg_session_duration':
        const sessionDurations = new Map<string, number[]>();

        for (const event of events) {
          if (!event.userId || !cohortUserIds.has(event.userId)) continue;

          if (!sessionDurations.has(event.sessionId)) {
            sessionDurations.set(event.sessionId, []);
          }

          sessionDurations.get(event.sessionId)!.push(event.timestamp);
        }

        const durations: number[] = [];

        for (const timestamps of sessionDurations.values()) {
          if (timestamps.length > 1) {
            const sorted = [...timestamps].sort((a, b) => a - b);
            durations.push(sorted[sorted.length - 1] - sorted[0]);
          }
        }

        return durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0;

      default:
        return 0;
    }
  }

  /**
   * Compare cohorts
   */
  compareCohorts(
    cohorts: Cohort[],
    events: AnalyticsEvent[],
    metrics: string[]
  ): CohortComparison {
    const cohortMetrics = cohorts.map((cohort) => {
      const metricValues = this.analyzeCohortMetrics(cohort, events, metrics);

      return {
        cohort,
        metrics: metricValues,
      };
    });

    // Calculate significant differences
    const significantDifferences = this.findSignificantDifferences(
      cohortMetrics,
      metrics
    );

    return {
      cohorts,
      comparisonMetrics: cohortMetrics.flatMap((cm) =>
        cm.metrics.map((m) => ({
          ...m,
          cohortName: cm.cohort.name,
        }))
      ),
      significantDifferences,
      generatedAt: Date.now(),
    };
  }

  /**
   * Find significant differences between cohorts
   */
  private findSignificantDifferences(
    cohortMetrics: Array<{ cohort: Cohort; metrics: CohortMetric[] }>,
    metricNames: string[]
  ): ComparisonDifference[] {
    const differences: ComparisonDifference[] = [];

    for (const metricName of metricNames) {
      const values = cohortMetrics.map((cm) => {
        const metric = cm.metrics.find((m) => m.name === metricName);
        return {
          cohortId: cm.cohort.id,
          cohortName: cm.cohort.name,
          value: metric?.value || 0,
        };
      });

      // Compare all pairs
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const v1 = values[i];
          const v2 = values[j];

          const absoluteChange = Math.abs(v1.value - v2.value);
          const relativeChange =
            v1.value !== 0 ? (absoluteChange / v1.value) * 100 : 0;

          // Simple significance test (would use proper statistical test in production)
          const significant = absoluteChange > Math.max(v1.value, v2.value) * 0.2;

          if (significant) {
            differences.push({
              metric: metricName,
              dimension1: v1.cohortName,
              dimension2: v2.cohortName,
              value1: v1.value,
              value2: v2.value,
              absoluteChange,
              relativeChange,
              statisticallySignificant: true,
              confidence: 0.95,
            });
          }
        }
      }
    }

    return differences;
  }

  /**
   * Calculate cohort overlap
   */
  calculateCohortOverlap(cohort1: Cohort, cohort2: Cohort): {
    overlap: number;
    overlapPercent1: number;
    overlapPercent2: number;
  } {
    const users1 = new Set(cohort1.users.map((u) => u.userId));
    const users2 = new Set(cohort2.users.map((u) => u.userId));

    const overlap = new Set([...users1].filter((u) => users2.has(u)));

    return {
      overlap: overlap.size,
      overlapPercent1: cohort1.size > 0 ? (overlap.size / cohort1.size) * 100 : 0,
      overlapPercent2: cohort2.size > 0 ? (overlap.size / cohort2.size) * 100 : 0,
    };
  }

  /**
   * Track cohort behavior over time
   */
  trackCohortBehavior(
    cohort: Cohort,
    events: AnalyticsEvent[],
    timeWindows: Array<{ value: number; unit: 'days' | 'weeks' | 'months' }>
  ): Array<{ window: string; metric: string; value: number }> {
    const cohortUserIds = new Set(cohort.users.map((u) => u.userId));
    const results: Array<{ window: string; metric: string; value: number }> = [];

    for (const timeWindow of timeWindows) {
      const windowMs =
        timeWindow.unit === 'days'
          ? timeWindow.value * 24 * 60 * 60 * 1000
          : timeWindow.unit === 'weeks'
          ? timeWindow.value * 7 * 24 * 60 * 60 * 1000
          : timeWindow.value * 30 * 24 * 60 * 60 * 1000;

      const now = Date.now();
      const windowStart = now - windowMs;

      const windowEvents = events.filter(
        (e) =>
          e.userId &&
          cohortUserIds.has(e.userId) &&
          e.timestamp >= windowStart &&
          e.timestamp <= now
      );

      const uniqueUsers = new Set(windowEvents.map((e) => e.userId)).size;
      const totalEvents = windowEvents.length;
      const conversions = windowEvents.filter((e) => e.eventType === 'conversion').length;

      results.push({
        window: `${timeWindow.value} ${timeWindow.unit}`,
        metric: 'active_users',
        value: uniqueUsers,
      });

      results.push({
        window: `${timeWindow.value} ${timeWindow.unit}`,
        metric: 'total_events',
        value: totalEvents,
      });

      results.push({
        window: `${timeWindow.value} ${timeWindow.unit}`,
        metric: 'conversions',
        value: conversions,
      });
    }

    return results;
  }

  /**
   * Calculate cohort health score
   */
  calculateHealthScore(
    cohort: Cohort,
    events: AnalyticsEvent[]
  ): {
    score: number;
    grade: string;
    factors: Array<{ name: string; score: number; weight: number }>;
  } {
    const factors: Array<{ name: string; score: number; weight: number }> = [];

    // Size factor (larger cohorts get higher scores)
    const sizeScore = Math.min(cohort.size / 1000, 1);
    factors.push({ name: 'Size', score: sizeScore, weight: 0.2 });

    // Activity factor
    const activityRate = this.calculateMetric(cohort, events, 'avg_events_per_user');
    const activityScore = Math.min(activityRate / 10, 1);
    factors.push({ name: 'Activity', score: activityScore, weight: 0.3 });

    // Conversion factor
    const conversionRate = this.calculateMetric(cohort, events, 'conversion_rate');
    const conversionScore = Math.min(conversionRate / 10, 1);
    factors.push({ name: 'Conversion', score: conversionScore, weight: 0.3 });

    // Retention factor
    const retentionRate = this.calculateMetric(cohort, events, 'retention_rate');
    const retentionScore = Math.min(retentionRate / 50, 1);
    factors.push({ name: 'Retention', score: retentionScore, weight: 0.2 });

    // Calculate weighted score
    const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

    // Determine grade
    let grade = 'F';
    if (score >= 0.9) grade = 'A';
    else if (score >= 0.8) grade = 'B';
    else if (score >= 0.7) grade = 'C';
    else if (score >= 0.6) grade = 'D';

    return {
      score: score * 100,
      grade,
      factors,
    };
  }
}
