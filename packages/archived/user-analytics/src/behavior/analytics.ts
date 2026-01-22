/**
 * Behavioral Analytics
 * User journey analysis, session analysis, and engagement tracking
 */

import type {
  UserJourney,
  JourneyStep,
  ConversionInfo,
  JourneyMetadata,
  BehaviorPattern,
  PatternType,
  PatternDefinition,
  PatternStep,
  SessionAnalysis,
  PageMetric,
  EventMetric,
  PageFlow,
  FlowNode,
  FlowEdge,
  EngagementMetrics,
  EngagementFactor,
  FeatureUsage,
  FeatureTrend,
  FeatureUser,
  FeatureCohortUsage,
  AnalyticsEvent,
  User,
  Session,
} from '../types/index.js';

// ============================================================================
// Journey Analyzer
// ============================================================================

export class JourneyAnalyzer {
  /**
   * Analyze user journeys
   */
  analyzeJourneys(events: AnalyticsEvent[], users?: User[]): UserJourney[] {
    const journeys: UserJourney[] = [];

    // Group events by user and session
    const userSessions = this.groupEventsByUserAndSession(events);

    for (const [userId, sessions] of userSessions.entries()) {
      for (const sessionEvents of sessions) {
        const journey = this.createJourney(userId, sessionEvents, users);
        if (journey) {
          journeys.push(journey);
        }
      }
    }

    return journeys;
  }

  /**
   * Analyze journeys for a specific user
   */
  analyzeUserJourney(
    userId: string,
    events: AnalyticsEvent[],
    users?: User[]
  ): UserJourney[] {
    const userEvents = events.filter((e) => e.userId === userId);
    const sessions = this.groupEventsBySession(userEvents);

    const journeys: UserJourney[] = [];

    for (const sessionEvents of sessions) {
      const journey = this.createJourney(userId, sessionEvents, users);
      if (journey) {
        journeys.push(journey);
      }
    }

    return journeys;
  }

  /**
   * Create a journey from events
   */
  private createJourney(
    userId: string,
    events: AnalyticsEvent[],
    users?: User[]
  ): UserJourney | null {
    if (events.length === 0) return null;

    const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    const steps: JourneyStep[] = sortedEvents.map((event, index) => {
      const timeFromStart = event.timestamp - sortedEvents[0].timestamp;
      const timeFromPrevious = index > 0
        ? event.timestamp - sortedEvents[index - 1].timestamp
        : 0;

      let type: 'page_view' | 'event' | 'conversion' | 'exit' = 'event';

      if (event.eventType === 'page_view') {
        type = 'page_view';
      } else if (event.eventType === 'conversion') {
        type = 'conversion';
      }

      if (index === sortedEvents.length - 1) {
        type = 'exit';
      }

      return {
        sequence: index,
        event,
        timeFromStart,
        timeFromPrevious,
        page: event.context?.url || event.context?.page,
        type,
      };
    });

    const conversion = this.detectConversion(sortedEvents);
    const metadata = this.createJourneyMetadata(sortedEvents, users);

    return {
      userId,
      sessionId: sortedEvents[0].sessionId,
      journey: steps,
      startTime: sortedEvents[0].timestamp,
      endTime: sortedEvents[sortedEvents.length - 1].timestamp,
      duration: sortedEvents[sortedEvents.length - 1].timestamp - sortedEvents[0].timestamp,
      eventCount: sortedEvents.length,
      conversion,
      metadata,
    };
  }

  /**
   * Detect conversion in journey
   */
  private detectConversion(events: AnalyticsEvent[]): ConversionInfo | undefined {
    const conversionEvents = events.filter((e) => e.eventType === 'conversion');

    if (conversionEvents.length === 0) return undefined;

    const firstConversion = conversionEvents[0];
    const conversionValue = firstConversion.properties?.value as number | undefined;

    return {
      converted: true,
      conversionValue,
      conversionEvent: firstConversion.eventName,
      timeToConvert: firstConversion.timestamp - events[0].timestamp,
    };
  }

  /**
   * Create journey metadata
   */
  private createJourneyMetadata(
    events: AnalyticsEvent[],
    users?: User[]
  ): JourneyMetadata {
    const firstEvent = events[0];

    return {
      device: firstEvent.context?.device,
      browser: firstEvent.context?.browser,
      source: firstEvent.context?.campaign?.source,
      medium: firstEvent.context?.campaign?.medium,
      campaign: firstEvent.context?.campaign?.campaign,
      location: firstEvent.context?.location,
      quality: this.assessJourneyQuality(events),
    };
  }

  /**
   * Assess journey quality
   */
  private assessJourneyQuality(events: AnalyticsEvent[]): 'high' | 'medium' | 'low' {
    const duration = events[events.length - 1].timestamp - events[0].timestamp;
    const eventCount = events.length;
    const hasConversion = events.some((e) => e.eventType === 'conversion');

    // High quality: good engagement and/or conversion
    if (hasConversion || (eventCount > 5 && duration > 30000)) {
      return 'high';
    }

    // Medium quality: some engagement
    if (eventCount > 2 && duration > 10000) {
      return 'medium';
    }

    // Low quality: minimal engagement
    return 'low';
  }

  /**
   * Group events by user and session
   */
  private groupEventsByUserAndSession(events: AnalyticsEvent[]): Map<string, AnalyticsEvent[][]> {
    const grouped = new Map<string, AnalyticsEvent[][]>();

    for (const event of events) {
      if (!event.userId) continue;

      if (!grouped.has(event.userId)) {
        grouped.set(event.userId, []);
      }

      // Find or create session group
      const sessions = grouped.get(event.userId)!;
      let sessionGroup = sessions.find((s) => s[0]?.sessionId === event.sessionId);

      if (!sessionGroup) {
        sessionGroup = [];
        sessions.push(sessionGroup);
      }

      sessionGroup.push(event);
    }

    return grouped;
  }

  /**
   * Group events by session
   */
  private groupEventsBySession(events: AnalyticsEvent[]): AnalyticsEvent[][] {
    const sessions = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, []);
      }
      sessions.get(event.sessionId)!.push(event);
    }

    return Array.from(sessions.values());
  }

  /**
   * Find common journey patterns
   */
  findCommonPatterns(journeys: UserJourney[], limit = 10): BehaviorPattern[] {
    const patterns = new Map<string, { count: number; example: UserJourney }>();

    for (const journey of journeys) {
      // Create pattern key from event types
      const patternKey = journey.journey
        .map((step) => step.event.eventName)
        .join(' -> ');

      const existing = patterns.get(patternKey);
      if (existing) {
        existing.count++;
      } else {
        patterns.set(patternKey, { count: 1, example: journey });
      }
    }

    return Array.from(patterns.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([pattern, data]) => ({
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Pattern: ${pattern.substring(0, 50)}...`,
        description: `Common journey pattern followed by ${data.count} users`,
        patternType: 'sequence' as PatternType,
        definition: {
          steps: data.example.journey.map((step) => ({
            eventType: step.event.eventType,
            eventName: step.event.eventName,
            properties: step.event.properties,
          })),
        },
        users: [],
        userCount: data.count,
        frequency: data.count,
        confidence: Math.min(data.count / journeys.length, 1),
        discoveredAt: Date.now(),
        lastUpdated: Date.now(),
      }));
  }
}

// ============================================================================
// Session Analyzer
// ============================================================================

export class SessionAnalyzer {
  /**
   * Analyze sessions
   */
  analyzeSessions(
    sessions: Session[],
    events: AnalyticsEvent[]
  ): SessionAnalysis[] {
    return sessions.map((session) => this.analyzeSession(session, events));
  }

  /**
   * Analyze a single session
   */
  analyzeSession(session: Session, events: AnalyticsEvent[]): SessionAnalysis {
    const sessionEvents = events.filter((e) => e.sessionId === session.id);

    const pageViews = sessionEvents.filter((e) => e.eventType === 'page_view');
    const duration = session.duration || (session.endTime || Date.now()) - session.startTime;

    return {
      sessionId: session.id,
      userId: session.userId,
      startTime: session.startTime,
      endTime: session.endTime || Date.now(),
      duration,
      eventCount: sessionEvents.length,
      pageViews: pageViews.length,
      bounceRate: pageViews.length <= 1 ? 100 : 0,
      pagesPerSession: pageViews.length,
      avgSessionDuration: duration,
      topPages: this.getTopPages(pageViews),
      topEvents: this.getTopEvents(sessionEvents),
      flow: this.analyzePageFlow(pageViews),
      engagement: this.calculateEngagement(sessionEvents),
      conversion: this.detectSessionConversion(sessionEvents),
    };
  }

  /**
   * Get top pages in session
   */
  private getTopPages(pageViews: AnalyticsEvent[]): PageMetric[] {
    const pageMap = new Map<string, { views: number; uniqueViews: Set<string>; durations: number[] }>();

    for (const pv of pageViews) {
      const page = pv.context?.page || pv.context?.url || 'unknown';
      const existing = pageMap.get(page);

      if (existing) {
        existing.views++;
        existing.uniqueViews.add(pv.userId || pv.anonymousId || 'unknown');
      } else {
        pageMap.set(page, {
          views: 1,
          uniqueViews: new Set([pv.userId || pv.anonymousId || 'unknown']),
          durations: [],
        });
      }
    }

    return Array.from(pageMap.entries())
      .map(([page, data]) => ({
        page,
        views: data.views,
        uniqueViews: data.uniqueViews.size,
        avgTimeOnPage: 0, // Would need more complex tracking
        bounceRate: 0,
        exitRate: 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }

  /**
   * Get top events in session
   */
  private getTopEvents(events: AnalyticsEvent[]): EventMetric[] {
    const eventMap = new Map<string, { count: number; uniqueUsers: Set<string> }>();

    for (const event of events) {
      const key = `${event.eventType}:${event.eventName}`;
      const existing = eventMap.get(key);

      if (existing) {
        existing.count++;
        existing.uniqueUsers.add(event.userId || event.anonymousId || 'unknown');
      } else {
        eventMap.set(key, {
          count: 1,
          uniqueUsers: new Set([event.userId || event.anonymousId || 'unknown']),
        });
      }
    }

    return Array.from(eventMap.entries())
      .map(([key, data]) => {
        const [eventType, eventName] = key.split(':');
        return {
          eventType,
          eventName,
          count: data.count,
          uniqueUsers: data.uniqueUsers.size,
          avgPerSession: data.count,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  /**
   * Analyze page flow
   */
  private analyzePageFlow(pageViews: AnalyticsEvent[]): PageFlow {
    const nodes = new Map<string, FlowNode>();
    const edges = new Map<string, FlowEdge>();
    const entryPoints = new Set<string>();
    const exitPoints = new Set<string>();

    for (let i = 0; i < pageViews.length; i++) {
      const pv = pageViews[i];
      const page = pv.context?.page || pv.context?.url || 'unknown';

      // Update or create node
      const existing = nodes.get(page);
      if (existing) {
        existing.views++;
        existing.uniqueUsers.add(pv.userId || pv.anonymousId || 'unknown');
      } else {
        nodes.set(page, {
          id: page,
          page,
          views: 1,
          uniqueUsers: new Set([pv.userId || pv.anonymousId || 'unknown']),
          avgTimeOnPage: 0,
          bounceRate: 0,
          exitRate: 0,
        });
      }

      // Track entry and exit points
      if (i === 0) {
        entryPoints.add(page);
      }
      if (i === pageViews.length - 1) {
        exitPoints.add(page);
      }

      // Create edge to next page
      if (i < pageViews.length - 1) {
        const nextPv = pageViews[i + 1];
        const nextPage = nextPv.context?.page || nextPv.context?.url || 'unknown';

        const edgeKey = `${page} -> ${nextPage}`;
        const existingEdge = edges.get(edgeKey);

        if (existingEdge) {
          existingEdge.count++;
          existingEdge.avgTimeBetween =
            (existingEdge.avgTimeBetween + (nextPv.timestamp - pv.timestamp)) / 2;
        } else {
          edges.set(edgeKey, {
            from: page,
            to: nextPage,
            count: 1,
            percentage: 0,
            avgTimeBetween: nextPv.timestamp - pv.timestamp,
          });
        }
      }
    }

    // Calculate percentages
    const totalEdges = Array.from(edges.values()).reduce((sum, e) => sum + e.count, 0);
    for (const edge of edges.values()) {
      edge.percentage = totalEdges > 0 ? (edge.count / totalEdges) * 100 : 0;
    }

    // Convert Set to Array for nodes
    const nodeArray = Array.from(nodes.values()).map((node) => ({
      ...node,
      uniqueUsers: node.uniqueUsers.size,
    }));

    return {
      nodes: nodeArray,
      edges: Array.from(edges.values()),
      entryPoints: Array.from(entryPoints),
      exitPoints: Array.from(exitPoints),
    };
  }

  /**
   * Calculate engagement metrics
   */
  private calculateEngagement(events: AnalyticsEvent[]): EngagementMetrics {
    const factors: EngagementFactor[] = [];

    // Event frequency factor
    const eventCount = events.length;
    factors.push({
      name: 'Event Frequency',
      value: eventCount,
      weight: 0.3,
      contribution: Math.min(eventCount / 20, 1) * 0.3,
    });

    // Session duration factor
    const duration = events.length > 0
      ? events[events.length - 1].timestamp - events[0].timestamp
      : 0;
    factors.push({
      name: 'Session Duration',
      value: duration,
      weight: 0.4,
      contribution: Math.min(duration / 300000, 1) * 0.4, // 5 min max
    });

    // Page diversity factor
    const uniquePages = new Set(
      events
        .filter((e) => e.eventType === 'page_view')
        .map((e) => e.context?.page || e.context?.url)
    ).size;
    factors.push({
      name: 'Page Diversity',
      value: uniquePages,
      weight: 0.2,
      contribution: Math.min(uniquePages / 5, 1) * 0.2,
    });

    // Interaction factor
    const interactions = events.filter(
      (e) => e.eventType === 'click' || e.eventType === 'interaction'
    ).length;
    factors.push({
      name: 'Interactions',
      value: interactions,
      weight: 0.1,
      contribution: Math.min(interactions / 10, 1) * 0.1,
    });

    const score = factors.reduce((sum, f) => sum + f.contribution, 0);

    let level: 'low' | 'medium' | 'high';
    if (score >= 0.7) level = 'high';
    else if (score >= 0.4) level = 'medium';
    else level = 'low';

    return {
      score: score * 100,
      level,
      factors,
      trend: 'stable', // Would need historical data
    };
  }

  /**
   * Detect session conversion
   */
  private detectSessionConversion(events: AnalyticsEvent[]): ConversionInfo | undefined {
    const conversionEvent = events.find((e) => e.eventType === 'conversion');

    if (!conversionEvent) return undefined;

    return {
      converted: true,
      conversionValue: conversionEvent.properties?.value as number | undefined,
      conversionEvent: conversionEvent.eventName,
      timeToConvert: conversionEvent.timestamp - events[0].timestamp,
    };
  }
}

// ============================================================================
// Pattern Discovery
// ============================================================================

export class PatternDiscovery {
  /**
   * Discover behavioral patterns
   */
  discoverPatterns(events: AnalyticsEvent[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Discover sequential patterns
    patterns.push(...this.discoverSequentialPatterns(events));

    // Discover frequency patterns
    patterns.push(...this.discoverFrequencyPatterns(events));

    // Discover timing patterns
    patterns.push(...this.discoverTimingPatterns(events));

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Discover sequential patterns
   */
  private discoverSequentialPatterns(events: AnalyticsEvent[]): BehaviorPattern[] {
    const sequences = new Map<string, { count: number; users: Set<string> }>();

    // Group events by user
    const userEvents = new Map<string, AnalyticsEvent[]>();
    for (const event of events) {
      if (!event.userId) continue;
      if (!userEvents.has(event.userId)) {
        userEvents.set(event.userId, []);
      }
      userEvents.get(event.userId)!.push(event);
    }

    // Find common 3-step sequences
    for (const [userId, userEventList] of userEvents.entries()) {
      const sorted = userEventList.sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 0; i < sorted.length - 2; i++) {
        const sequence = [
          sorted[i].eventName,
          sorted[i + 1].eventName,
          sorted[i + 2].eventName,
        ].join(' -> ');

        const existing = sequences.get(sequence);
        if (existing) {
          existing.count++;
          existing.users.add(userId);
        } else {
          sequences.set(sequence, {
            count: 1,
            users: new Set([userId]),
          });
        }
      }
    }

    return Array.from(sequences.entries())
      .filter(([_, data]) => data.count >= 5 && data.users.size >= 3)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([sequence, data]) => ({
        id: `pattern_seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Sequence: ${sequence.substring(0, 50)}`,
        description: `Common sequence performed by ${data.users.size} users`,
        patternType: 'sequence' as PatternType,
        definition: {
          steps: sequence.split(' -> ').map((name) => ({
            eventType: 'custom',
            eventName: name,
          })),
        },
        users: Array.from(data.users),
        userCount: data.users.size,
        frequency: data.count,
        confidence: data.users.size / userEvents.size,
        discoveredAt: Date.now(),
        lastUpdated: Date.now(),
      }));
  }

  /**
   * Discover frequency patterns
   */
  private discoverFrequencyPatterns(events: AnalyticsEvent[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Find events that occur frequently for the same user
    const userEventCounts = new Map<string, Map<string, number>>();

    for (const event of events) {
      if (!event.userId) continue;

      if (!userEventCounts.has(event.userId)) {
        userEventCounts.set(event.userId, new Map());
      }

      const userCounts = userEventCounts.get(event.userId)!;
      userCounts.set(event.eventName, (userCounts.get(event.eventName) || 0) + 1);
    }

    // Find events that users do frequently
    const eventFrequency = new Map<string, { totalUsers: number; totalCount: number }>();

    for (const [userId, eventCounts] of userEventCounts.entries()) {
      for (const [eventName, count] of eventCounts.entries()) {
        if (count >= 5) {
          // User did this event at least 5 times
          const existing = eventFrequency.get(eventName);
          if (existing) {
            existing.totalUsers++;
            existing.totalCount += count;
          } else {
            eventFrequency.set(eventName, {
              totalUsers: 1,
              totalCount: count,
            });
          }
        }
      }
    }

    for (const [eventName, data] of eventFrequency.entries()) {
      if (data.totalUsers >= 3) {
        patterns.push({
          id: `pattern_freq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Frequent: ${eventName}`,
          description: `Event performed frequently by ${data.totalUsers} users`,
          patternType: 'frequency' as PatternType,
          definition: {
            steps: [{
              eventType: 'custom',
              eventName,
            }],
            minOccurrences: 5,
          },
          users: [],
          userCount: data.totalUsers,
          frequency: data.totalCount,
          confidence: data.totalUsers / userEventCounts.size,
          discoveredAt: Date.now(),
          lastUpdated: Date.now(),
        });
      }
    }

    return patterns;
  }

  /**
   * Discover timing patterns
   */
  private discoverTimingPatterns(events: AnalyticsEvent[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Analyze event timing patterns
    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<number, number>();

    for (const event of events) {
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      const day = date.getDay();

      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }

    // Find peak hours
    const avgHour = Array.from(hourCounts.values()).reduce((a, b) => a + b, 0) / 24;
    const peakHours = Array.from(hourCounts.entries())
      .filter(([_, count]) => count > avgHour * 1.5)
      .map(([hour, _]) => hour);

    if (peakHours.length > 0) {
      patterns.push({
        id: `pattern_time_hour_${Date.now()}`,
        name: 'Peak Hours Activity',
        description: `Users are most active during ${peakHours.join(', ')}:00`,
        patternType: 'timing' as PatternType,
        definition: {
          steps: [],
        },
        users: [],
        userCount: 0,
        frequency: Array.from(hourCounts.values()).reduce((a, b) => a + b, 0),
        confidence: 0.8,
        discoveredAt: Date.now(),
        lastUpdated: Date.now(),
      });
    }

    return patterns;
  }
}

// ============================================================================
// Feature Usage Analyzer
// ============================================================================

export class FeatureUsageAnalyzer {
  /**
   * Analyze feature usage
   */
  analyzeFeatureUsage(
    events: AnalyticsEvent[],
    users: User[],
    featureNames: string[]
  ): FeatureUsage[] {
    return featureNames.map((featureName) =>
      this.analyzeSingleFeature(events, users, featureName)
    );
  }

  /**
   * Analyze usage of a single feature
   */
  private analyzeSingleFeature(
    events: AnalyticsEvent[],
    users: User[],
    featureName: string
  ): FeatureUsage {
    const featureEvents = events.filter((e) => e.eventName === featureName);
    const featureUsers = new Set(featureEvents.map((e) => e.userId).filter(Boolean) as string[]);

    const adoptionRate = users.length > 0 ? (featureUsers.size / users.length) * 100 : 0;
    const usageFrequency = featureEvents.length / featureUsers.size;

    return {
      featureName,
      users: featureUsers.size,
      totalUsers: users.length,
      adoptionRate,
      usageFrequency,
      avgUsagePerUser: featureEvents.length / (featureUsers.size || 1),
      avgTimeSpent: this.calculateAvgTimeSpent(featureEvents),
      retention: this.calculateFeatureRetention(featureEvents),
      trend: this.calculateFeatureTrend(featureEvents),
      topUsers: this.getTopFeatureUsers(featureEvents, featureUsers),
      cohorts: this.getFeatureCohortUsage(featureEvents, users),
    };
  }

  /**
   * Calculate average time spent on feature
   */
  private calculateAvgTimeSpent(events: AnalyticsEvent[]): number {
    // This would require more detailed event tracking
    // For now, return a placeholder
    return 0;
  }

  /**
   * Calculate feature retention
   */
  private calculateFeatureRetention(events: AnalyticsEvent[]): number {
    const userEvents = new Map<string, AnalyticsEvent[]>();

    for (const event of events) {
      if (!event.userId) continue;
      if (!userEvents.has(event.userId)) {
        userEvents.set(event.userId, []);
      }
      userEvents.get(event.userId)!.push(event);
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let retainedUsers = 0;
    for (const [_, userEvents] of userEvents.entries()) {
      const sorted = userEvents.sort((a, b) => a.timestamp - b.timestamp);
      const firstEvent = sorted[0];
      const lastEvent = sorted[sorted.length - 1];

      // Check if user used feature in last 30 days
      if (lastEvent.timestamp >= thirtyDaysAgo && lastEvent.timestamp !== firstEvent.timestamp) {
        retainedUsers++;
      }
    }

    return userEvents.size > 0 ? (retainedUsers / userEvents.size) * 100 : 0;
  }

  /**
   * Calculate feature trend
   */
  private calculateFeatureTrend(events: AnalyticsEvent[]): FeatureTrend {
    const now = Date.now();
    const weekInMs = 7 * 24 * 60 * 60 * 1000;

    const thisWeek = events.filter((e) => e.timestamp >= now - weekInMs).length;
    const lastWeek = events.filter(
      (e) => e.timestamp >= now - 2 * weekInMs && e.timestamp < now - weekInMs
    ).length;

    const change = thisWeek - lastWeek;
    const changePercent = lastWeek > 0 ? (change / lastWeek) * 100 : 0;

    let direction: 'up' | 'down' | 'stable';
    if (Math.abs(changePercent) < 10) direction = 'stable';
    else if (changePercent > 0) direction = 'up';
    else direction = 'down';

    return {
      period: 'week',
      change,
      changePercent,
      direction,
    };
  }

  /**
   * Get top users of a feature
   */
  private getTopFeatureUsers(
    events: AnalyticsEvent[],
    featureUsers: Set<string>
  ): FeatureUser[] {
    const userUsage = new Map<string, number>();

    for (const event of events) {
      if (!event.userId) continue;
      userUsage.set(event.userId, (userUsage.get(event.userId) || 0) + 1);
    }

    return Array.from(userUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, usageCount]) => ({
        userId,
        usageCount,
        lastUsed: events.filter((e) => e.userId === userId).sort((a, b) => b.timestamp - a.timestamp)[0]?.timestamp || 0,
        avgTimeSpent: 0,
      }));
  }

  /**
   * Get feature usage by cohort
   */
  private getFeatureCohortUsage(events: AnalyticsEvent[], users: User[]): FeatureCohortUsage[] {
    const cohorts = ['new', 'returning', 'churned'];
    const cohortUsage: FeatureCohortUsage[] = [];

    for (const cohort of cohorts) {
      const cohortUsers = users.filter((u) => {
        const daysSinceCreated = (Date.now() - u.createdAt) / (24 * 60 * 60 * 1000);
        if (cohort === 'new') return daysSinceCreated <= 7;
        if (cohort === 'returning') return daysSinceCreated > 7 && daysSinceCreated <= 30;
        return daysSinceCreated > 30;
      });

      const cohortUserIds = new Set(cohortUsers.map((u) => u.id));
      const cohortEvents = events.filter((e) => e.userId && cohortUserIds.has(e.userId));
      const uniqueUsers = new Set(cohortEvents.map((e) => e.userId)).size;

      cohortUsage.push({
        cohortName: cohort,
        usageRate: cohortUsers.length > 0 ? (uniqueUsers / cohortUsers.length) * 100 : 0,
        avgTimeSpent: 0,
      });
    }

    return cohortUsage;
  }
}
