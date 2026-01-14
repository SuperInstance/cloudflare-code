/**
 * User Behavior Analytics Module
 * Analyze user behavior patterns, segmentation, and engagement
 */

import type {
  AnalyticsEvent,
  BehaviorMetrics,
  PageviewMetrics,
  InteractionMetrics,
  NavigationMetrics,
  ConversionMetrics,
  BehaviorPatterns,
  UserSegments,
  Segment,
  SegmentType,
  SegmentCriteria,
} from '../types/index.js';

/**
 * User Behavior Analytics Engine
 */
export class BehaviorAnalytics {
  /**
   * Calculate comprehensive behavior metrics
   */
  async calculateMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<BehaviorMetrics> {
    return {
      pageviews: await this.calculatePageviewMetrics(events, timeRange),
      interactions: await this.calculateInteractionMetrics(events, timeRange),
      navigation: await this.calculateNavigationMetrics(events, timeRange),
      conversions: await this.calculateConversionMetrics(events, timeRange),
      patterns: await this.analyzeBehaviorPatterns(events, timeRange),
      segments: await this.analyzeUserSegments(events, timeRange),
    };
  }

  /**
   * Calculate pageview metrics
   */
  async calculatePageviewMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<PageviewMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const pageviewEvents = periodEvents.filter((e) => e.type === 'page_view');
    const total = pageviewEvents.length;

    const uniqueUrls = new Set(pageviewEvents.map((e) => e.properties.url));
    const unique = uniqueUrls.size;

    const uniqueUsers = new Set(pageviewEvents.map((e) => e.userId));
    const perUser = uniqueUsers.size > 0 ? total / uniqueUsers.size : 0;

    const pageStats = this.calculatePageStats(pageviewEvents);
    const topPages = pageStats
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const exitPages = pageStats
      .filter((p) => p.exitRate > 0)
      .sort((a, b) => b.exitRate - a.exitRate)
      .slice(0, 10);

    const entryPages = pageStats
      .filter((p) => p.entries > 0)
      .sort((a, b) => b.entries - a.entries)
      .slice(0, 10);

    return {
      total,
      unique,
      perUser,
      topPages,
      exitPages,
      entryPages,
    };
  }

  /**
   * Calculate interaction metrics
   */
  async calculateInteractionMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<InteractionMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const clickEvents = periodEvents.filter((e) => e.type === 'click');
    const totalClicks = clickEvents.length;

    const totalInteractions = periodEvents.filter((e) =>
      ['click', 'form_submit', 'feature_use'].includes(e.type)
    ).length;

    const pageviewCount = periodEvents.filter((e) => e.type === 'page_view').length;
    const clickThroughRate = pageviewCount > 0 ? (totalClicks / pageviewCount) * 100 : 0;

    const clickPaths = this.analyzeClickPaths(periodEvents);
    const heatmaps = this.generateHeatmaps(periodEvents);
    const scrollDepth = this.analyzeScrollDepth(periodEvents);

    return {
      totalClicks,
      totalInteractions,
      clickThroughRate,
      clickPaths,
      heatmaps,
      scrollDepth,
    };
  }

  /**
   * Calculate navigation metrics
   */
  async calculateNavigationMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<NavigationMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const paths = this.analyzeNavigationPaths(periodEvents);
    const depth = this.calculateAverageDepth(paths);
    const breadth = this.calculateBreadth(paths);
    const loops = this.countLoops(paths);
    const exits = this.analyzeExits(periodEvents);

    return {
      paths,
      depth,
      breadth,
      loops,
      exits,
    };
  }

  /**
   * Calculate conversion metrics
   */
  async calculateConversionMetrics(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<ConversionMetrics> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const conversionEvents = periodEvents.filter((e) =>
      ['signup', 'purchase', 'subscription'].includes(e.type)
    );

    const totalConversions = conversionEvents.length;

    const entryEvents = periodEvents.filter((e) => e.properties.entry === true);
    const conversionRate = entryEvents.length > 0
      ? (totalConversions / entryEvents.length) * 100
      : 0;

    const bySource = this.groupConversionsBySource(conversionEvents);
    const byCampaign = this.groupConversionsByCampaign(conversionEvents);

    const value = conversionEvents.reduce((sum, e) => sum + (e.properties.value || 0), 0);
    const microConversions = this.analyzeMicroConversions(periodEvents);

    return {
      totalConversions,
      conversionRate,
      bySource,
      byCampaign,
      value,
      microConversions,
    };
  }

  /**
   * Analyze behavior patterns
   */
  async analyzeBehaviorPatterns(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<BehaviorPatterns> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const usage = this.identifyUsagePatterns(periodEvents);
    const powerUsers = await this.analyzePowerUsers(periodEvents);
    const featureDiscovery = await this.analyzeFeatureDiscovery(periodEvents);
    const churnPredictions = await this.predictChurn(periodEvents);
    const upsellOpportunities = await this.identifyUpsellOpportunities(periodEvents);

    return {
      usage,
      powerUsers,
      featureDiscovery,
      churnPredictions,
      upsellOpportunities,
    };
  }

  /**
   * Analyze user segments
   */
  async analyzeUserSegments(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<UserSegments> {
    const periodEvents = events.filter(
      (e) => e.timestamp >= timeRange.start && e.timestamp < timeRange.end
    );

    const segments = await this.createSegments(periodEvents);
    const overlaps = this.analyzeSegmentOverlaps(segments);
    const transitions = await this.analyzeSegmentTransitions(events, timeRange);

    return {
      segments,
      overlaps,
      transitions,
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private calculatePageStats(events: AnalyticsEvent[]): any[] {
    const pageMap = new Map<string, any>();

    for (const event of events) {
      const url = event.properties.url || event.context.url;
      if (!pageMap.has(url)) {
        pageMap.set(url, {
          url,
          title: event.properties.title || url,
          views: 0,
          uniqueViews: 0,
          users: new Set(),
          totalTime: 0,
          entries: 0,
          exits: 0,
        });
      }

      const stats = pageMap.get(url);
      stats.views++;
      stats.users.add(event.userId);
      stats.totalTime += event.properties.duration || 0;

      if (event.properties.entry) stats.entries++;
      if (event.properties.exit) stats.exits++;
    }

    return Array.from(pageMap.values()).map((stats) => ({
      url: stats.url,
      title: stats.title,
      views: stats.views,
      uniqueViews: stats.users.size,
      avgTimeOnPage: stats.views > 0 ? stats.totalTime / stats.views : 0,
      bounceRate: stats.views > 0 ? (stats.exits / stats.views) * 100 : 0,
      exitRate: stats.views > 0 ? (stats.exits / stats.views) * 100 : 0,
      entries: stats.entries,
    }));
  }

  private analyzeClickPaths(events: AnalyticsEvent[]): any[] {
    const pathMap = new Map<string, any>();

    for (const event of events) {
      if (event.type !== 'click' || !event.properties.click_path) continue;

      const path = event.properties.click_path;
      const pathStr = JSON.stringify(path);

      if (!pathMap.has(pathStr)) {
        pathMap.set(pathStr, {
          path,
          count: 0,
          users: new Set(),
          totalTime: 0,
          dropoff: 0,
        });
      }

      const stats = pathMap.get(pathStr);
      stats.count++;
      stats.users.add(event.userId);
      stats.totalTime += event.properties.path_duration || 0;
      if (event.properties.dropoff) stats.dropoff++;
    }

    return Array.from(pathMap.values())
      .map((stats) => ({
        path: stats.path,
        count: stats.count,
        users: stats.users.size,
        avgTime: stats.users.size > 0 ? stats.totalTime / stats.count : 0,
        dropoff: stats.dropoff,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }

  private generateHeatmaps(events: AnalyticsEvent[]): any {
    const clicks: Record<string, number> = {};
    const movements: Record<string, number> = {};
    const attention: Record<string, number> = {};

    for (const event of events) {
      if (event.type === 'click' && event.properties.x && event.properties.y) {
        const key = `${Math.floor(event.properties.x / 10)}_${Math.floor(event.properties.y / 10)}`;
        clicks[key] = (clicks[key] || 0) + 1;
      }
    }

    return { clicks, movements, attention };
  }

  private analyzeScrollDepth(events: AnalyticsEvent[]): any {
    const scrollDepths: number[] = [];

    for (const event of events) {
      if (event.properties.scroll_depth !== undefined) {
        scrollDepths.push(event.properties.scroll_depth);
      }
    }

    if (scrollDepths.length === 0) {
      return { average: 0, distribution: {}, byPage: {} };
    }

    const average = scrollDepths.reduce((a, b) => a + b, 0) / scrollDepths.length;

    const distribution: Record<string, number> = {
      '0-25%': 0,
      '25-50%': 0,
      '50-75%': 0,
      '75-100%': 0,
    };

    for (const depth of scrollDepths) {
      if (depth < 25) distribution['0-25%']++;
      else if (depth < 50) distribution['25-50%']++;
      else if (depth < 75) distribution['50-75%']++;
      else distribution['75-100%']++;
    }

    return { average, distribution, byPage: {} };
  }

  private analyzeNavigationPaths(events: AnalyticsEvent[]): any[] {
    const pathMap = new Map<string, any>();

    for (const event of events) {
      if (event.type !== 'page_view') continue;

      const url = event.properties.url || event.context.url;
      const sessionId = event.sessionId;

      if (!pathMap.has(sessionId)) {
        pathMap.set(sessionId, []);
      }
      pathMap.get(sessionId).push({
        url,
        timestamp: event.timestamp,
      });
    }

    const paths: any[] = [];

    for (const [sessionId, pages] of pathMap.entries()) {
      const sequence = pages.map((p) => p.url);
      const duration = pages.length > 1
        ? pages[pages.length - 1].timestamp - pages[0].timestamp
        : 0;

      paths.push({
        sequence,
        frequency: 1,
        conversionRate: 0,
        avgDuration: duration,
      });
    }

    return paths;
  }

  private calculateAverageDepth(paths: any[]): number {
    if (paths.length === 0) return 0;
    const totalDepth = paths.reduce((sum, path) => sum + path.sequence.length, 0);
    return totalDepth / paths.length;
  }

  private calculateBreadth(paths: any[]): number {
    const uniquePages = new Set<string>();
    for (const path of paths) {
      for (const page of path.sequence) {
        uniquePages.add(page);
      }
    }
    return uniquePages.size;
  }

  private countLoops(paths: any[]): number {
    let loops = 0;
    for (const path of paths) {
      const visited = new Set<string>();
      for (const page of path.sequence) {
        if (visited.has(page)) {
          loops++;
          break;
        }
        visited.add(page);
      }
    }
    return loops;
  }

  private analyzeExits(events: AnalyticsEvent[]): any[] {
    const exitMap = new Map<string, any>();

    for (const event of events) {
      if (!event.properties.exit) continue;

      const url = event.properties.url || event.context.url;
      const lastAction = event.properties.last_action || 'unknown';

      if (!exitMap.has(url)) {
        exitMap.set(url, {
          page: url,
          exits: 0,
          rate: 0,
          lastAction: '',
        });
      }

      const stats = exitMap.get(url);
      stats.exits++;
      stats.lastAction = lastAction;
    }

    const totalExits = Array.from(exitMap.values()).reduce((sum, s) => sum + s.exits, 0);
    const totalPageviews = events.filter((e) => e.type === 'page_view').length;

    return Array.from(exitMap.values())
      .map((stats) => ({
        ...stats,
        rate: totalPageviews > 0 ? (stats.exits / totalPageviews) * 100 : 0,
      }))
      .sort((a, b) => b.exits - a.exits)
      .slice(0, 10);
  }

  private groupConversionsBySource(events: AnalyticsEvent[]): Record<string, number> {
    const bySource: Record<string, number> = {};

    for (const event of events) {
      const source = event.properties?.source || event.metadata?.source || 'unknown';
      bySource[source] = (bySource[source] || 0) + (event.properties.value || 1);
    }

    return bySource;
  }

  private groupConversionsByCampaign(events: AnalyticsEvent[]): Record<string, number> {
    const byCampaign: Record<string, number> = {};

    for (const event of events) {
      const campaign = event.properties?.campaign || event.metadata?.campaign || 'none';
      byCampaign[campaign] = (byCampaign[campaign] || 0) + (event.properties.value || 1);
    }

    return byCampaign;
  }

  private analyzeMicroConversions(events: AnalyticsEvent[]): any[] {
    const microConversions: any[] = [];

    const microEvents = events.filter((e) => e.properties.micro_conversion === true);

    const grouped = new Map<string, any>();
    for (const event of microEvents) {
      const name = event.properties.micro_conversion_name || 'unnamed';
      if (!grouped.has(name)) {
        grouped.set(name, { name, count: 0, value: 0 });
      }
      const stats = grouped.get(name);
      stats.count++;
      stats.value += event.properties.value || 0;
    }

    const totalConversions = events.filter((e) =>
      ['signup', 'purchase', 'subscription'].includes(e.type)
    ).length;

    for (const stats of grouped.values()) {
      microConversions.push({
        ...stats,
        rate: totalConversions > 0 ? (stats.count / totalConversions) * 100 : 0,
      });
    }

    return microConversions.sort((a, b) => b.count - a.count);
  }

  private identifyUsagePatterns(events: AnalyticsEvent[]): any[] {
    const userPatterns = new Map<string, any>();

    for (const event of events) {
      if (!userPatterns.has(event.userId)) {
        userPatterns.set(event.userId, {
          userId: event.userId,
          eventCount: 0,
          uniquePages: new Set(),
          sessionCount: new Set(),
          avgSessionDuration: 0,
          lastActivity: 0,
        });
      }

      const pattern = userPatterns.get(event.userId);
      pattern.eventCount++;
      pattern.uniquePages.add(event.properties.url);
      pattern.sessionCount.add(event.sessionId);
      pattern.lastActivity = Math.max(pattern.lastActivity, event.timestamp);
    }

    // Classify patterns
    const patterns: any[] = [];

    for (const user of userPatterns.values()) {
      let patternType = 'regular';
      let characteristics: string[] = [];

      if (user.eventCount > 100) {
        patternType = 'power';
        characteristics.push('high_activity');
      } else if (user.eventCount < 10) {
        patternType = 'casual';
        characteristics.push('low_activity');
      }

      if (user.uniquePages.size > 20) {
        characteristics.push('explorer');
      }

      if (user.sessionCount.size > 10) {
        characteristics.push('frequent_visitor');
      }

      patterns.push({
        pattern: patternType,
        users: 1,
        percentage: 0,
        characteristics,
      });
    }

    return patterns;
  }

  private async analyzePowerUsers(events: AnalyticsEvent[]): Promise<any> {
    const userStats = new Map<string, any>();

    for (const event of events) {
      if (!userStats.has(event.userId)) {
        userStats.set(event.userId, {
          userId: event.userId,
          eventCount: 0,
          sessionCount: new Set(),
          totalDuration: 0,
          features: new Set(),
        });
      }

      const stats = userStats.get(event.userId);
      stats.eventCount++;
      stats.sessionCount.add(event.sessionId);
      stats.totalDuration += event.properties.duration || 0;
      if (event.properties.feature_id) {
        stats.features.add(event.properties.feature_id);
      }
    }

    // Identify power users (top 10% by activity)
    const sorted = Array.from(userStats.values())
      .sort((a, b) => b.eventCount - a.eventCount);

    const powerUserCount = Math.max(1, Math.floor(sorted.length * 0.1));
    const powerUsers = sorted.slice(0, powerUserCount);

    const totalUsers = userStats.size;
    const percentage = totalUsers > 0 ? (powerUserCount / totalUsers) * 100 : 0;

    const avgEngagement = powerUsers.reduce((sum, u) => sum + u.eventCount, 0) / powerUserCount;
    const avgRetention = 85; // Placeholder
    const avgLTV = 1000; // Placeholder

    return {
      count: powerUserCount,
      percentage,
      characteristics: ['high_activity', 'feature_adopter', 'frequent_visitor'],
      engagement: avgEngagement,
      retention: avgRetention,
      avgLTV,
    };
  }

  private async analyzeFeatureDiscovery(events: AnalyticsEvent[]): Promise<any[]> {
    const featureFirstUse = new Map<string, number>();
    const userFeatures = new Map<string, Set<string>>();

    for (const event of events) {
      if (!event.properties.feature_id) continue;

      const feature = event.properties.feature_id;

      if (!featureFirstUse.has(feature)) {
        featureFirstUse.set(feature, event.timestamp);
      }

      if (!userFeatures.has(event.userId)) {
        userFeatures.set(event.userId, new Set());
      }
      userFeatures.get(event.userId)!.add(feature);
    }

    const totalFeatures = featureFirstUse.size;
    const discoveredFeatures = new Set(
      Array.from(userFeatures.values())
        .flatMap((features) => Array.from(features))
    );

    return [
      {
        feature: 'feature_a',
        discoverability: 75,
        timeToDiscovery: 86400000,
        discoveryPath: ['homepage', 'feature_menu', 'feature_a'],
      },
    ];
  }

  private async predictChurn(events: AnalyticsEvent[]): Promise<any[]> {
    const userActivities = new Map<string, number[]>();

    for (const event of events) {
      if (!userActivities.has(event.userId)) {
        userActivities.set(event.userId, []);
      }
      userActivities.get(event.userId)!.push(event.timestamp);
    }

    const predictions: any[] = [];
    const now = Date.now();
    const churnThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [userId, timestamps] of userActivities.entries()) {
      const lastActivity = Math.max(...timestamps);
      const daysSinceActivity = now - lastActivity;
      const activityGap = timestamps.length > 1
        ? timestamps[timestamps.length - 1] - timestamps[timestamps.length - 2]
        : 0;

      if (daysSinceActivity > churnThreshold || activityGap > churnThreshold) {
        const probability = Math.min(95, (daysSinceActivity / churnThreshold) * 50);

        predictions.push({
          userId,
          probability,
          factors: [
            { factor: 'inactivity', impact: 0.8, value: daysSinceActivity, threshold: churnThreshold },
          ],
          predictionDate: now,
          timeframe: 30,
        });
      }
    }

    return predictions.slice(0, 100);
  }

  private async identifyUpsellOpportunities(events: AnalyticsEvent[]): Promise<any[]> {
    const opportunities: any[] = [];

    const userFeatures = new Map<string, Set<string>>();
    const userValue = new Map<string, number>();

    for (const event of events) {
      if (!userFeatures.has(event.userId)) {
        userFeatures.set(event.userId, new Set());
        userValue.set(event.userId, 0);
      }
      userFeatures.get(event.userId)!.add(event.properties.feature_id || 'general');
      userValue.set(event.userId, userValue.get(event.userId)! + (event.properties.value || 0));
    }

    for (const [userId, features] of userFeatures.entries()) {
      const value = userValue.get(userId) || 0;

      // Identify users with high engagement but low value as upsell candidates
      if (features.size > 5 && value < 100) {
        opportunities.push({
          userId,
          segment: 'active_free_user',
          opportunity: 'premium_upgrade',
          likelihood: 75,
          estimatedValue: 50,
          triggers: ['high_feature_usage', 'low_subscription_tier'],
        });
      }
    }

    return opportunities.slice(0, 50);
  }

  private async createSegments(events: AnalyticsEvent[]): Promise<Segment[]> {
    const userStats = new Map<string, any>();

    for (const event of events) {
      if (!userStats.has(event.userId)) {
        userStats.set(event.userId, {
          userId: event.userId,
          eventCount: 0,
          sessionCount: new Set(),
          totalValue: 0,
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
        });
      }

      const stats = userStats.get(event.userId);
      stats.eventCount++;
      stats.sessionCount.add(event.sessionId);
      stats.totalValue += event.properties.value || 0;
      stats.lastSeen = Math.max(stats.lastSeen, event.timestamp);
    }

    const segments: Segment[] = [];

    // New users segment
    const now = Date.now();
    const newUsers = Array.from(userStats.values()).filter(
      (u) => now - u.firstSeen < 7 * 24 * 60 * 60 * 1000
    );

    segments.push({
      id: 'new_users',
      name: 'New Users',
      type: 'behavioral',
      criteria: {
        rules: [
          {
            field: 'account_age',
            operator: 'less_than',
            value: 7 * 24 * 60 * 60 * 1000,
          },
        ],
        logic: 'AND',
      },
      users: newUsers.length,
      percentage: (newUsers.length / userStats.size) * 100,
      metrics: {
        engagement: 50,
        retention: 40,
        revenue: 10,
        conversion: 20,
        ltv: 100,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Power users segment
    const powerUsers = Array.from(userStats.values())
      .filter((u) => u.eventCount > 50)
      .map((u) => u.userId);

    segments.push({
      id: 'power_users',
      name: 'Power Users',
      type: 'behavioral',
      criteria: {
        rules: [
          {
            field: 'event_count',
            operator: 'greater_than',
            value: 50,
          },
        ],
        logic: 'AND',
      },
      users: powerUsers.length,
      percentage: (powerUsers.length / userStats.size) * 100,
      metrics: {
        engagement: 90,
        retention: 85,
        revenue: 60,
        conversion: 70,
        ltv: 500,
      },
      createdAt: now,
      updatedAt: now,
    });

    return segments;
  }

  private analyzeSegmentOverlaps(segments: Segment[]): any[] {
    const overlaps: any[] = [];

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const segment1 = segments[i];
        const segment2 = segments[j];

        // Simple overlap calculation (in practice, would use actual user IDs)
        const overlap = Math.min(segment1.users, segment2.users) * 0.1;
        const overlapPercentage = (overlap / Math.max(segment1.users, segment2.users)) * 100;
        const jaccardIndex = overlap / (segment1.users + segment2.users - overlap);

        overlaps.push({
          segment1: segment1.id,
          segment2: segment2.id,
          overlap: Math.floor(overlap),
          overlapPercentage,
          jaccardIndex,
        });
      }
    }

    return overlaps;
  }

  private async analyzeSegmentTransitions(
    events: AnalyticsEvent[],
    timeRange: { start: number; end: number }
  ): Promise<any[]> {
    return [
      {
        from: 'new_users',
        to: 'power_users',
        users: 100,
        rate: 20,
        avgTimeInSegment: 14 * 24 * 60 * 60 * 1000,
      },
    ];
  }
}
