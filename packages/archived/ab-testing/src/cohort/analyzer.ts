/**
 * Cohort Analyzer - Analyzes experiment performance across
 * different user segments and cohorts
 */

import type {
  ExperimentResults,
  CohortDefinition,
  CohortAnalysis,
  UserId,
  Assignment,
  Event,
  TargetingCriteria
} from '../types/experiment.js';
import { CohortAnalysisError } from '../types/errors.js';
import { StatisticalEngine } from '../statistics/engine.js';

/**
 * Cohort segment
 */
export interface CohortSegment {
  /** Segment name */
  name: string;
  /** User IDs in this segment */
  userIds: Set<UserId>;
  /** Filter criteria */
  criteria: TargetingCriteria;
}

/**
 * User attributes for cohort filtering
 */
export interface UserAttributes {
  /** User ID */
  userId: UserId;
  /** Attributes */
  attributes: Record<string, unknown>;
}

/**
 * Cohort comparison result
 */
export interface CohortComparison {
  /** Cohort name */
  cohortName: string;
  /** Experiment results for cohort */
  results: ExperimentResults;
  /** Comparison with baseline */
  comparison: {
    /** Relative lift vs baseline */
    lift: number;
    /** Absolute difference */
    absoluteDifference: number;
    /** Statistical significance */
    significant: boolean;
    /** Confidence interval */
    confidenceInterval: [number, number];
  };
  /** Sample size */
  sampleSize: number;
}

/**
 * Time-based cohort definition
 */
export interface TimeCohort {
  /** Cohort name */
  name: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
}

/**
 * Geographic cohort definition
 */
export interface GeographicCohort {
  /** Cohort name */
  name: string;
  /** Countries/regions */
  countries: string[];
  /** Regions/states */
  regions?: string[];
}

/**
 * Behavioral cohort definition
 */
export interface BehavioralCohort {
  /** Cohort name */
  name: string;
  /** Behavior criteria */
  criteria: {
    /** Minimum number of sessions */
    minSessions?: number;
    /** Minimum activity period (days) */
    minActivityDays?: number;
    /** User type (new, returning, power) */
    userType?: 'new' | 'returning' | 'power';
    /** Device type */
    deviceType?: string[];
  };
}

/**
 * Cohort Analyzer class
 */
export class CohortAnalyzer {
  private statisticalEngine: StatisticalEngine;

  constructor() {
    this.statisticalEngine = new StatisticalEngine();
  }

  /**
   * Create a cohort from user attributes
   */
  createCohort(
    name: string,
    users: UserAttributes[],
    criteria: TargetingCriteria
  ): CohortSegment {
    const userIds = new Set<UserId>();

    for (const user of users) {
      if (this.matchesCriteria(user, criteria)) {
        userIds.add(user.userId);
      }
    }

    return {
      name,
      userIds,
      criteria
    };
  }

  /**
   * Create time-based cohorts
   */
  createTimeCohorts(
    users: Assignment[],
    bucketSize: number = 24 * 60 * 60 * 1000 // 1 day
  ): TimeCohort[] {
    const cohorts = new Map<number, Set<UserId>>();

    // Group users by time bucket
    for (const user of users) {
      const bucket = Math.floor(user.assignedAt / bucketSize);
      if (!cohorts.has(bucket)) {
        cohorts.set(bucket, new Set());
      }
      cohorts.get(bucket)!.add(user.userId);
    }

    // Create cohort definitions
    return Array.from(cohorts.entries()).map(([bucket, userIds], index) => ({
      name: `Time Cohort ${index + 1}`,
      startTime: bucket * bucketSize,
      endTime: (bucket + 1) * bucketSize
    }));
  }

  /**
   * Create geographic cohorts
   */
  createGeographicCohorts(
    users: UserAttributes[]
  ): GeographicCohort[] {
    const countryGroups = new Map<string, Set<UserId>>();

    // Group by country
    for (const user of users) {
      const country = (user.attributes.country as string) || 'unknown';
      if (!countryGroups.has(country)) {
        countryGroups.set(country, new Set());
      }
      countryGroups.get(country)!.add(user.userId);
    }

    // Create cohorts for significant groups
    const cohorts: GeographicCohort[] = [];

    for (const [country, userIds] of countryGroups.entries()) {
      if (userIds.size >= 100) { // Minimum size threshold
        cohorts.push({
          name: `${country} Users`,
          countries: [country]
        });
      }
    }

    return cohorts;
  }

  /**
   * Create behavioral cohorts
   */
  createBehavioralCohorts(
    users: UserAttributes[],
    events: Map<UserId, Event[]>
  ): BehavioralCohort[] {
    const cohorts: BehavioralCohort[] = [];

    // New users (joined in last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newUsers = users.filter(u => {
      const firstSeen = u.attributes.firstSeen as number;
      return firstSeen >= sevenDaysAgo;
    });

    if (newUsers.length >= 100) {
      cohorts.push({
        name: 'New Users',
        criteria: { userType: 'new' }
      });
    }

    // Power users (high activity)
    const powerUsers = users.filter(u => {
      const userEvents = events.get(u.userId) ?? [];
      return userEvents.length >= 50;
    });

    if (powerUsers.length >= 100) {
      cohorts.push({
        name: 'Power Users',
        criteria: { userType: 'power', minSessions: 50 }
      });
    }

    // Mobile users
    const mobileUsers = users.filter(u => {
      const device = u.attributes.device as string;
      return device?.toLowerCase().includes('mobile');
    });

    if (mobileUsers.length >= 100) {
      cohorts.push({
        name: 'Mobile Users',
        criteria: { deviceType: ['mobile', 'ios', 'android'] }
      });
    }

    return cohorts;
  }

  /**
   * Analyze experiment results for a specific cohort
   */
  analyzeCohort(
    cohort: CohortSegment,
    assignments: Assignment[],
    events: Event[],
    experimentConfig: any
  ): CohortAnalysis {
    // Filter assignments and events for cohort
    const cohortAssignments = assignments.filter(a => cohort.userIds.has(a.userId));
    const cohortUserIds = new Set(cohortAssignments.map(a => a.userId));
    const cohortEvents = events.filter(e => cohortUserIds.has(e.userId));

    // Calculate results for this cohort
    const results = this.calculateResults(cohortAssignments, cohortEvents, experimentConfig);

    // Compare with overall (placeholder - would need overall results)
    const comparison = {
      lift: 0,
      significant: false,
      confidenceInterval: [0, 0] as [number, number]
    };

    return {
      cohortName: cohort.name,
      results,
      comparison
    };
  }

  /**
   * Compare results across multiple cohorts
   */
  compareCohorts(
    cohorts: CohortSegment[],
    assignments: Assignment[],
    events: Event[],
    experimentConfig: any
  ): CohortComparison[] {
    const comparisons: CohortComparison[] = [];

    // Calculate overall baseline
    const overallResults = this.calculateResults(assignments, events, experimentConfig);

    for (const cohort of cohorts) {
      const analysis = this.analyzeCohort(cohort, assignments, events, experimentConfig);

      const primaryMetric = Object.keys(analysis.results.variantStats[0]?.metrics ?? {})[0];

      if (primaryMetric && overallResults.variantStats[0]?.metrics[primaryMetric]) {
        const cohortValue = analysis.results.variantStats[0]?.metrics[primaryMetric]?.mean ?? 0;
        const overallValue = overallResults.variantStats[0]?.metrics[primaryMetric]?.mean ?? 0;

        const lift = overallValue !== 0 ? (cohortValue - overallValue) / overallValue : 0;
        const absoluteDifference = cohortValue - overallValue;

        // Simplified significance test
        const significant = Math.abs(lift) > 0.05;

        comparisons.push({
          cohortName: cohort.name,
          results: analysis.results,
          comparison: {
            lift,
            absoluteDifference,
            significant,
            confidenceInterval: [
              absoluteDifference * 0.8,
              absoluteDifference * 1.2
            ]
          },
          sampleSize: cohort.userIds.size
        });
      }
    }

    return comparisons;
  }

  /**
   * Find homogeneous cohorts (users with similar behavior)
   */
  findHomogeneousCohorts(
    users: UserAttributes[],
    events: Map<UserId, Event[]>,
    maxCohorts: number = 5
  ): CohortSegment[] {
    // Simplified clustering based on activity level
    const activityLevels = new Map<UserId, number>();

    for (const [userId, userEvents] of events.entries()) {
      activityLevels.set(userId, userEvents.length);
    }

    // Sort by activity
    const sorted = Array.from(activityLevels.entries()).sort((a, b) => a[1] - b[1]);

    // Create quantile-based cohorts
    const cohortSize = Math.floor(sorted.length / maxCohorts);
    const cohorts: CohortSegment[] = [];

    for (let i = 0; i < maxCohorts; i++) {
      const start = i * cohortSize;
      const end = i === maxCohorts - 1 ? sorted.length : (i + 1) * cohortSize;

      const userIds = new Set(sorted.slice(start, end).map(([userId]) => userId));

      cohorts.push({
        name: `Activity Cohort ${i + 1}`,
        userIds,
        criteria: {}
      });
    }

    return cohorts;
  }

  /**
   * Detect interaction effects between cohorts
   */
  detectInteractions(
    cohorts: CohortSegment[],
    assignments: Assignment[],
    events: Event[]
  ): Map<string, number> {
    const interactions = new Map<string, number>();

    // Calculate pairwise interaction strengths
    for (let i = 0; i < cohorts.length; i++) {
      for (let j = i + 1; j < cohorts.length; j++) {
        const cohort1 = cohorts[i];
        const cohort2 = cohorts[j];

        // Calculate interaction strength (simplified)
        const overlap = this.calculateOverlap(cohort1, cohort2);
        const expectedOverlap =
          (cohort1.userIds.size / assignments.length) *
          (cohort2.userIds.size / assignments.length) *
          assignments.length;

        const interactionStrength =
          expectedOverlap > 0 ? overlap / expectedOverlap : 0;

        interactions.set(
          `${cohort1.name} x ${cohort2.name}`,
          interactionStrength
        );
      }
    }

    return interactions;
  }

  /**
   * Generate cohort report
   */
  generateCohortReport(comparisons: CohortComparison[]): string {
    const lines: string[] = [];

    lines.push('# Cohort Analysis Report');
    lines.push('');
    lines.push(`## Analysis Summary`);
    lines.push(`- Cohorts analyzed: ${comparisons.length}`);
    lines.push(`- Generated at: ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## Cohort Performance');
    lines.push('');

    for (const comparison of comparisons) {
      lines.push(`### ${comparison.cohortName}`);
      lines.push(`- Sample size: ${comparison.sampleSize}`);
      lines.push(`- Lift vs baseline: ${(comparison.comparison.lift * 100).toFixed(2)}%`);
      lines.push(`- Absolute difference: ${comparison.comparison.absoluteDifference.toFixed(4)}`);
      lines.push(`- Significant: ${comparison.comparison.significant ? 'Yes' : 'No'}`);
      lines.push('');
    }

    // Find best performing cohort
    const bestCohort = comparisons.reduce((best, current) =>
      current.comparison.lift > best.comparison.lift ? current : best
    );

    lines.push('## Key Findings');
    lines.push(`- Best performing cohort: ${bestCohort.cohortName}`);
    lines.push(`- Lift: ${(bestCohort.comparison.lift * 100).toFixed(2)}%`);
    lines.push('');

    return lines.join('\n');
  }

  // Private helper methods

  private matchesCriteria(user: UserAttributes, criteria: TargetingCriteria): boolean {
    // Check inclusion criteria
    if (criteria.include) {
      for (const segment of criteria.include) {
        if (!this.matchesSegment(user, segment)) {
          return false;
        }
      }
    }

    // Check exclusion criteria
    if (criteria.exclude) {
      for (const segment of criteria.exclude) {
        if (this.matchesSegment(user, segment)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesSegment(user: UserAttributes, segment: any): boolean {
    for (const condition of segment.conditions) {
      const value = user.attributes[condition.field];

      let matches = false;
      switch (condition.operator) {
        case 'eq':
          matches = value === condition.value;
          break;
        case 'ne':
          matches = value !== condition.value;
          break;
        case 'gt':
          matches = typeof value === 'number' && value > (condition.value as number);
          break;
        case 'lt':
          matches = typeof value === 'number' && value < (condition.value as number);
          break;
        case 'in':
          matches = Array.isArray(condition.value) && condition.value.includes(value);
          break;
        case 'contains':
          matches =
            typeof value === 'string' && value.includes(condition.value as string);
          break;
      }

      if (!matches) {
        return false;
      }
    }

    return true;
  }

  private calculateResults(
    assignments: Assignment[],
    events: Event[],
    experimentConfig: any
  ): ExperimentResults {
    // Simplified result calculation
    const variantStats = new Map<string, any>();

    for (const assignment of assignments) {
      if (!variantStats.has(assignment.variantId)) {
        variantStats.set(assignment.variantId, {
          variantId: assignment.variantId,
          sampleSize: 0,
          metrics: {}
        });
      }

      const stats = variantStats.get(assignment.variantId)!;
      stats.sampleSize++;
    }

    // Add metrics from events
    for (const event of events) {
      const stats = variantStats.get(event.variantId);
      if (stats) {
        for (const [metricName, value] of Object.entries(event.metrics)) {
          if (typeof value === 'number') {
            if (!stats.metrics[metricName]) {
              stats.metrics[metricName] = {
                count: 0,
                sum: 0,
                mean: 0,
                variance: 0,
                standardDeviation: 0,
                min: Infinity,
                max: -Infinity,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
              };
            }

            const metric = stats.metrics[metricName];
            metric.count++;
            metric.sum += value;
            metric.mean = metric.sum / metric.count;
            metric.min = Math.min(metric.min, value);
            metric.max = Math.max(metric.max, value);
          }
        }
      }
    }

    return {
      experimentId: experimentConfig.id,
      status: 'running',
      variantStats: Array.from(variantStats.values()),
      testResults: {},
      totalParticipants: assignments.length,
      timestamp: Date.now()
    };
  }

  private calculateOverlap(cohort1: CohortSegment, cohort2: CohortSegment): number {
    let overlap = 0;

    for (const userId of cohort1.userIds) {
      if (cohort2.userIds.has(userId)) {
        overlap++;
      }
    }

    return overlap;
  }
}
