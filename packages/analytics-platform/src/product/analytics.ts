/**
 * Product Analytics Module
 * Comprehensive product metrics: DAU, MAU, engagement, retention, churn
 */

import type {
  AnalyticsEvent,
  ProductMetrics,
  UserGrowthMetrics,
  EngagementMetrics,
  RetentionMetrics,
  ChurnMetrics,
  FeatureUsageMetrics,
  SessionMetrics,
} from '../types/index.js';
import { AggregationEngine } from '../aggregation/engine.js';

/**
 * Product Analytics Engine
 */
export class ProductAnalytics {
  private aggregation: AggregationEngine;

  constructor(aggregation?: AggregationEngine) {
    this.aggregation = aggregation || new AggregationEngine();
  }

  /**
   * Calculate comprehensive product metrics
   */
  async calculateMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<ProductMetrics> {
    return {
      dau: await this.calculateDAU(events, timeRange),
      mau: await this.calculateMAU(events, timeRange),
      wau: await this.calculateWAU(events, timeRange),
      userGrowth: await this.calculateUserGrowth(events, timeRange),
      engagement: await this.calculateEngagement(events, timeRange),
      retention: await this.calculateRetention(events, timeRange),
      churn: await this.calculateChurn(events, timeRange),
      featureUsage: await this.calculateFeatureUsage(events, timeRange),
      sessionMetrics: await this.calculateSessionMetrics(events, timeRange),
    };
  }

  /**
   * Calculate Daily Active Users (DAU)
   */
  async calculateDAU(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number> {
    const dayEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const uniqueUsers = new Set(dayEvents.map((e) => e.userId));
    return uniqueUsers.size;
  }

  /**
   * Calculate Weekly Active Users (WAU)
   */
  async calculateWAU(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number> {
    const weekEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const uniqueUsers = new Set(weekEvents.map((e) => e.userId));
    return uniqueUsers.size;
  }

  /**
   * Calculate Monthly Active Users (MAU)
   */
  async calculateMAU(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<number> {
    const monthEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const uniqueUsers = new Set(monthEvents.map((e) => e.userId));
    return uniqueUsers.size;
  }

  /**
   * Calculate user growth metrics
   */
  async calculateUserGrowth(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<UserGrowthMetrics> {
    // Group events by day
    const dailyUsers = this.groupUsersByPeriod(events, 'day');
    const sortedDays = Object.keys(dailyUsers).sort();

    const firstDayUsers = dailyUsers[sortedDays[0]]?.size || 0;
    const lastDayUsers = dailyUsers[sortedDays[sortedDays.length - 1]]?.size || 0;

    const totalUsers = new Set(events.map((e) => e.userId)).size;
    const newUsers = this.identifyNewUsers(events, timeRange);

    const growthRate = firstDayUsers > 0
      ? ((lastDayUsers - firstDayUsers) / firstDayUsers) * 100
      : 0;

    return {
      newUsers,
      totalUsers,
      growthRate,
      growthBreakdown: await this.analyzeGrowthBreakdown(events, timeRange),
    };
  }

  /**
   * Calculate engagement metrics
   */
  async calculateEngagement(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<EngagementMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const uniqueUsers = new Set(periodEvents.map((e) => e.userId));
    const sessions = this.groupEventsBySession(periodEvents);

    const dayEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );
    const dau = new Set(dayEvents.map((e) => e.userId)).size;

    const weekStart = timeRange.start - 7 * 24 * 60 * 60 * 1000;
    const weekEvents = events.filter(
      (e) => e.timestamp >= weekStart && e.timestamp < timeRange.start
    );
    const wau = new Set(weekEvents.map((e) => e.userId)).size;

    const monthStart = timeRange.start - 30 * 24 * 60 * 60 * 1000;
    const monthEvents = events.filter(
      (e) => e.timestamp >= monthStart && e.timestamp < timeRange.start
    );
    const mau = new Set(monthEvents.map((e) => e.userId)).size;

    const stickiness = mau > 0 ? (dau / mau) * 100 : 0;

    const sessionDurations = this.calculateSessionDurations(sessions);
    const avgSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
      : 0;

    const sessionsPerUser = uniqueUsers.size > 0 ? sessions.length / uniqueUsers.size : 0;

    const pageviewsPerSession = sessions.length > 0
      ? periodEvents.length / sessions.length
      : 0;

    const singlePageSessions = sessions.filter((s) => s.length <= 1).length;
    const bounceRate = sessions.length > 0
      ? (singlePageSessions / sessions.length) * 100
      : 0;

    return {
      dailyActiveUsers: dau,
      weeklyActiveUsers: wau,
      monthlyActiveUsers: mau,
      stickiness,
      averageSessionDuration: avgSessionDuration,
      averageSessionsPerUser: sessionsPerUser,
      pageviewsPerSession,
      bounceRate,
    };
  }

  /**
   * Calculate retention metrics
   */
  async calculateRetention(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<RetentionMetrics> {
    const cohortUsers = this.getCohortUsers(events, timeRange.start);
    const retentionData = this.calculateRetentionByCohort(events, cohortUsers, timeRange);

    return {
      day1: retentionData.day1,
      day7: retentionData.day7,
      day30: retentionData.day30,
      day90: retentionData.day90,
      rolling: retentionData.rolling,
      cohort: retentionData.cohort,
    };
  }

  /**
   * Calculate churn metrics
   */
  async calculateChurn(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<ChurnMetrics> {
    const periodMs = timeRange.end - timeRange.start;
    const previousStart = timeRange.start - periodMs;

    const currentUsers = this.getActiveUsers(events, timeRange.start, timeRange.end);
    const previousUsers = this.getActiveUsers(events, previousStart, timeRange.start);

    const churnedUsers = previousUsers.filter((u) => !currentUsers.includes(u));
    const churned = churnedUsers.length;
    const total = previousUsers.length;

    const rate = total > 0 ? (churned / total) * 100 : 0;

    const bySegment = await this.analyzeChurnBySegment(events, churnedUsers, timeRange);
    const byReason = await this.analyzeChurnByReason(events, churnedUsers);

    // Calculate risk score for current users
    const atRiskUsers = await this.identifyAtRiskUsers(events, currentUsers, timeRange);
    const riskScore = currentUsers.length > 0
      ? (atRiskUsers.length / currentUsers.length) * 100
      : 0;

    return {
      rate,
      count: churned,
      bySegment,
      byReason,
      riskScore,
      atRiskUsers: atRiskUsers.length,
    };
  }

  /**
   * Calculate feature usage metrics
   */
  async calculateFeatureUsage(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<FeatureUsageMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const allFeatures = this.extractFeatures(periodEvents);
    const activeFeatures = new Set(
      periodEvents
        .filter((e) => e.properties.feature_id)
        .map((e) => e.properties.feature_id)
    );

    const featureUsers = this.groupFeatureUsage(periodEvents);
    const totalUsers = new Set(periodEvents.map((e) => e.userId)).size;

    const adoptionRate = totalUsers > 0
      ? (activeFeatures.size / allFeatures.length) * 100
      : 0;

    const topFeatures = this.getTopFeatures(featureUsers, 10);

    return {
      totalFeatures: allFeatures.length,
      activeFeatures: activeFeatures.size,
      adoptionRate,
      topFeatures,
      featureDiscovery: await this.analyzeFeatureDiscovery(events, timeRange),
    };
  }

  /**
   * Calculate session metrics
   */
  async calculateSessionMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<SessionMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const sessions = this.groupEventsBySession(periodEvents);
    const sessionDurations = this.calculateSessionDurations(sessions);

    const pageviews = periodEvents.filter((e) => e.type === 'page_view').length;
    const pageviewsPerSession = sessions.length > 0 ? pageviews / sessions.length : 0;

    const singlePageSessions = sessions.filter((s) => s.length <= 1).length;
    const bounceRate = sessions.length > 0 ? (singlePageSessions / sessions.length) * 100 : 0;

    const users = new Set(periodEvents.map((e) => e.userId));
    const sessionsPerUser = users.size > 0 ? sessions.length / users.size : 0;

    return {
      totalSessions: sessions.length,
      averageDuration: sessionDurations.length > 0
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
        : 0,
      averagePageviews: pageviewsPerSession,
      medianDuration: this.calculateMedian(sessionDurations),
      sessionsPerUser,
      bounceRate,
      timeDistribution: await this.calculateTimeDistribution(periodEvents),
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private groupUsersByPeriod(events: AnalyticsEvent[], period: 'day' | 'week' | 'month'): Record<string, Set<string>> {
    const grouped: Record<string, Set<string>> = {};

    for (const event of events) {
      const date = new Date(event.timestamp);
      let key: string;

      if (period === 'day') {
        key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      } else {
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      }

      if (!grouped[key]) {
        grouped[key] = new Set();
      }
      grouped[key].add(event.userId);
    }

    return grouped;
  }

  private identifyNewUsers(events: AnalyticsEvent[], timeRange: { start: number; end: number }): number {
    const beforeEvents = events.filter((e) => e.timestamp < timeRange.start);
    const existingUsers = new Set(beforeEvents.map((e) => e.userId));

    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );
    const newUsers = periodEvents.filter((e) => !existingUsers.has(e.userId));

    return new Set(newUsers.map((e) => e.userId)).size;
  }

  private async analyzeGrowthBreakdown(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<any> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const breakdown: Record<string, number> = {
      organic: 0,
      paid: 0,
      referral: 0,
      direct: 0,
      other: 0,
    };

    for (const event of periodEvents) {
      const source = event.properties?.source || event.properties?.utm_source || 'other';
      if (breakdown[source] !== undefined) {
        breakdown[source]++;
      } else {
        breakdown.other++;
      }
    }

    return breakdown;
  }

  private groupEventsBySession(events: AnalyticsEvent[]): AnalyticsEvent[][] {
    const sessionsMap = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      const sessionId = event.sessionId;
      if (!sessionsMap.has(sessionId)) {
        sessionsMap.set(sessionId, []);
      }
      sessionsMap.get(sessionId)!.push(event);
    }

    return Array.from(sessionsMap.values());
  }

  private calculateSessionDurations(sessions: AnalyticsEvent[][]): number[] {
    return sessions.map((session) => {
      if (session.length < 2) return 0;
      const sorted = [...session].sort((a, b) => a.timestamp - b.timestamp);
      return sorted[sorted.length - 1].timestamp - sorted[0].timestamp;
    });
  }

  private getCohortUsers(events: AnalyticsEvent[], cohortStart: number): Set<string> {
    const cohortEvents = events.filter(
      (e) => e.timestamp >= cohortStart && e.timestamp < cohortStart + 24 * 60 * 60 * 1000
    );
    return new Set(cohortEvents.map((e) => e.userId));
  }

  private calculateRetentionByCohort(
    events: AnalyticsEvent[],
    cohortUsers: Set<string>,
    timeRange: { start: number; end: number }
  ): any {
    const day1Ms = 24 * 60 * 60 * 1000;

    const calculateRetention = (days: number) => {
      const periodStart = timeRange.start + days * day1Ms;
      const periodEnd = periodStart + day1Ms;

      const activeUsers = events
        .filter((e) => e.timestamp >= periodStart && e.timestamp < periodEnd)
        .map((e) => e.userId);

      const retained = cohortUsers.intersection(new Set(activeUsers));
      return cohortUsers.size > 0 ? (retained.size / cohortUsers.size) * 100 : 0;
    };

    return {
      day1: calculateRetention(1),
      day7: calculateRetention(7),
      day30: calculateRetention(30),
      day90: calculateRetention(90),
      rolling: {
        r1: calculateRetention(1),
        r7: calculateRetention(7),
        r30: calculateRetention(30),
        r90: calculateRetention(90),
      },
      cohort: {
        byAcquisitionWeek: {},
        bySignupMonth: {},
      },
    };
  }

  private getActiveUsers(events: AnalyticsEvent[], start: number, end: number): string[] {
    const periodEvents = events.filter((e) => e.timestamp >= start && e.timestamp < end);
    return Array.from(new Set(periodEvents.map((e) => e.userId)));
  }

  private async analyzeChurnBySegment(
    events: AnalyticsEvent[],
    churnedUsers: string[],
    timeRange: { start: number; end: number }
  ): Promise<Record<string, number>> {
    const segments: Record<string, number> = {
      new: 0,
      active: 0,
      inactive: 0,
      paid: 0,
      free: 0,
    };

    // Implementation would segment users by various criteria
    return segments;
  }

  private async analyzeChurnByReason(
    events: AnalyticsEvent[],
    churnedUsers: string[]
  ): Promise<Record<string, number>> {
    const reasons: Record<string, number> = {
      'No activity': 0,
      'Technical issues': 0,
      'Cost': 0,
      'Found alternative': 0,
      'Other': 0,
    };

    // Implementation would analyze churn reasons from events
    return reasons;
  }

  private async identifyAtRiskUsers(
    events: AnalyticsEvent[],
    currentUsers: string[],
    timeRange: { start: number; end: number }
  ): Promise<string[]> {
    const atRisk: string[] = [];
    const riskThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const userId of currentUsers) {
      const userEvents = events.filter((e) => e.userId === userId);
      const lastActivity = Math.max(...userEvents.map((e) => e.timestamp));
      const daysSinceActivity = timeRange.end - lastActivity;

      if (daysSinceActivity > riskThreshold) {
        atRisk.push(userId);
      }
    }

    return atRisk;
  }

  private extractFeatures(events: AnalyticsEvent[]): string[] {
    const features = new Set<string>();

    for (const event of events) {
      if (event.properties.feature_id) {
        features.add(event.properties.feature_id);
      }
    }

    return Array.from(features);
  }

  private groupFeatureUsage(events: AnalyticsEvent[]): Map<string, Set<string>> {
    const featureUsers = new Map<string, Set<string>>();

    for (const event of events) {
      if (event.properties.feature_id) {
        const featureId = event.properties.feature_id;
        if (!featureUsers.has(featureId)) {
          featureUsers.set(featureId, new Set());
        }
        featureUsers.get(featureId)!.add(event.userId);
      }
    }

    return featureUsers;
  }

  private getTopFeatures(featureUsers: Map<string, Set<string>>, limit: number): any[] {
    const features = Array.from(featureUsers.entries()).map(([feature, users]) => ({
      featureId: feature,
      featureName: feature,
      users: users.size,
      usage: 0,
      uniqueUsers: users.size,
      adoptionRate: 0,
      avgUsagePerUser: 0,
    }));

    return features
      .sort((a, b) => b.users - a.users)
      .slice(0, limit);
  }

  private async analyzeFeatureDiscovery(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<any> {
    return {
      discovered: 0,
      undiscovered: 0,
      timeToFirstUse: 0,
      discoveryFunnel: {},
    };
  }

  private async calculateTimeDistribution(events: AnalyticsEvent[]): Promise<any> {
    const hourly = new Array(24).fill(0);
    const daily = new Array(7).fill(0);

    for (const event of events) {
      const date = new Date(event.timestamp);
      hourly[date.getHours()]++;
      daily[date.getDay()]++;
    }

    return {
      hourly,
      daily,
      weekly: [],
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
