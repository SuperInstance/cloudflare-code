/**
 * Segmentation Engine
 * Dynamic user segmentation with behavioral and demographic targeting
 */

import type {
  Segment,
  SegmentType,
  SegmentDefinition,
  SegmentCondition,
  SegmentOperator,
  SegmentUser,
  SegmentUpdate,
  User,
  AnalyticsEvent,
  TimeWindow,
  SegmentMetadata,
} from '../types/index.js';

// ============================================================================
// Segment Builder
// ============================================================================

export class SegmentBuilder {
  private idGenerator: () => string;

  constructor(idGenerator?: () => string) {
    this.idGenerator = idGenerator || (() => this.generateId());
  }

  /**
   * Create a new segment
   */
  createSegment(
    name: string,
    type: SegmentType,
    definition: SegmentDefinition,
    metadata?: Partial<SegmentMetadata>
  ): Segment {
    const id = this.idGenerator();
    const now = Date.now();

    return {
      id,
      name,
      description: metadata?.description,
      type,
      definition,
      users: [],
      count: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {
        color: metadata?.color,
        icon: metadata?.icon,
        category: metadata?.category,
        tags: metadata?.tags || [],
        public: metadata?.public || false,
        sharable: metadata?.sharable || false,
      },
    };
  }

  /**
   * Create a dynamic segment based on user properties
   */
  createUserPropertySegment(
    name: string,
    conditions: SegmentCondition[],
    metadata?: Partial<SegmentMetadata>
  ): Segment {
    return this.createSegment(
      name,
      'dynamic',
      {
        conditions,
        logic: 'and',
        refreshInterval: 3600000, // 1 hour
      },
      metadata
    );
  }

  /**
   * Create a behavioral segment
   */
  createBehavioralSegment(
    name: string,
    conditions: SegmentCondition[],
    timeWindow?: TimeWindow,
    metadata?: Partial<SegmentMetadata>
  ): Segment {
    return this.createSegment(
      name,
      'behavioral',
      {
        conditions,
        logic: 'and',
        refreshInterval: 1800000, // 30 minutes
        sampleSize: 10000,
      },
      metadata
    );
  }

  /**
   * Create a demographic segment
   */
  createDemographicSegment(
    name: string,
    conditions: SegmentCondition[],
    metadata?: Partial<SegmentMetadata>
  ): Segment {
    return this.createSegment(
      name,
      'demographic',
      {
        conditions,
        logic: 'and',
        refreshInterval: 86400000, // 24 hours
      },
      metadata
    );
  }

  /**
   * Create a lookalike segment
   */
  createLookalikeSegment(
    name: string,
    sourceSegmentId: string,
    conditions: SegmentCondition[],
    metadata?: Partial<SegmentMetadata>
  ): Segment {
    return this.createSegment(
      name,
      'lookalike',
      {
        conditions,
        logic: 'or',
        refreshInterval: 3600000,
        sampleSize: 50000,
      },
      {
        ...metadata,
        lookalikeSource: sourceSegmentId,
      }
    );
  }

  private generateId(): string {
    return `seg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Segment Evaluator
// ============================================================================

export class SegmentEvaluator {
  /**
   * Evaluate if a user matches a segment
   */
  matchesSegment(user: User, segment: Segment): boolean {
    const { conditions, logic = 'and' } = segment.definition;

    const results = conditions.map((condition) =>
      this.matchesCondition(user, condition)
    );

    return logic === 'and'
      ? results.every((r) => r)
      : results.some((r) => r);
  }

  /**
   * Evaluate if a user matches a condition
   */
  matchesCondition(user: User, condition: SegmentCondition): boolean {
    const value = this.getFieldValue(user, condition.field);

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;

      case 'not_equals':
        return value !== condition.value;

      case 'contains':
        return typeof value === 'string' &&
          String(condition.value).toLowerCase().split(',')
            .some((v) => value.toLowerCase().includes(v.trim()));

      case 'not_contains':
        return typeof value === 'string' &&
          !String(condition.value).toLowerCase().split(',')
            .some((v) => value.toLowerCase().includes(v.trim()));

      case 'starts_with':
        return typeof value === 'string' &&
          value.startsWith(String(condition.value));

      case 'ends_with':
        return typeof value === 'string' &&
          value.endsWith(String(condition.value));

      case 'greater_than':
        return typeof value === 'number' && value > Number(condition.value);

      case 'less_than':
        return typeof value === 'number' && value < Number(condition.value);

      case 'greater_than_or_equal':
        return typeof value === 'number' && value >= Number(condition.value);

      case 'less_than_or_equal':
        return typeof value === 'number' && value <= Number(condition.value);

      case 'in':
        return Array.isArray(condition.value) &&
          condition.value.includes(value);

      case 'not_in':
        return Array.isArray(condition.value) &&
          !condition.value.includes(value);

      case 'is_set':
        return value !== null && value !== undefined;

      case 'is_not_set':
        return value === null || value === undefined;

      case 'before':
        return typeof value === 'number' && value < Number(condition.value);

      case 'after':
        return typeof value === 'number' && value > Number(condition.value);

      case 'between':
        if (Array.isArray(condition.value) && condition.value.length === 2) {
          const [min, max] = condition.value;
          return typeof value === 'number' &&
            value >= Number(min) &&
            value <= Number(max);
        }
        return false;

      case 'regex':
        try {
          const regex = new RegExp(String(condition.value), 'i');
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }

      default:
        return false;
    }
  }

  /**
   * Get field value from user object
   */
  private getFieldValue(user: User, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = user;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Calculate match score for a user
   */
  calculateMatchScore(user: User, segment: Segment): number {
    const { conditions } = segment.definition;
    let score = 0;
    let weightedSum = 0;

    for (const condition of conditions) {
      const matches = this.matchesCondition(user, condition);
      const weight = this.getConditionWeight(condition);

      if (matches) {
        score += weight;
      }

      weightedSum += weight;
    }

    return weightedSum > 0 ? score / weightedSum : 0;
  }

  /**
   * Get weight for a condition based on complexity
   */
  private getConditionWeight(condition: SegmentCondition): number {
    // More specific conditions get higher weight
    switch (condition.operator) {
      case 'equals':
      case 'not_equals':
        return 1;
      case 'in':
      case 'not_in':
        return 1.5;
      case 'contains':
      case 'not_contains':
        return 2;
      case 'between':
      case 'regex':
        return 2.5;
      default:
        return 1;
    }
  }
}

// ============================================================================
// Segment Manager
// ============================================================================

export class SegmentManager {
  private segments: Map<string, Segment>;
  private evaluator: SegmentEvaluator;
  private userCache: Map<string, User>;
  private eventHistory: Map<string, AnalyticsEvent[]>;
  private config: SegmentationConfig;

  constructor(config: Partial<SegmentationConfig> = {}) {
    this.segments = new Map();
    this.evaluator = new SegmentEvaluator();
    this.userCache = new Map();
    this.eventHistory = new Map();
    this.config = {
      maxSegments: config.maxSegments || 1000,
      maxUsersPerSegment: config.maxUsersPerSegment || 1000000,
      refreshInterval: config.refreshInterval || 3600000,
      enableCaching: config.enableCaching !== false,
      cacheTTL: config.cacheTTL || 300000,
    };
  }

  /**
   * Add a segment
   */
  addSegment(segment: Segment): void {
    if (this.segments.size >= this.config.maxSegments) {
      throw new Error('Maximum number of segments reached');
    }

    this.segments.set(segment.id, segment);
  }

  /**
   * Get a segment by ID
   */
  getSegment(segmentId: string): Segment | undefined {
    return this.segments.get(segmentId);
  }

  /**
   * Get all segments
   */
  getAllSegments(): Segment[] {
    return Array.from(this.segments.values());
  }

  /**
   * Get segments by type
   */
  getSegmentsByType(type: SegmentType): Segment[] {
    return Array.from(this.segments.values()).filter((s) => s.type === type);
  }

  /**
   * Update a segment
   */
  updateSegment(
    segmentId: string,
    updates: Partial<Segment>
  ): Segment | null {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      return null;
    }

    const updated = {
      ...segment,
      ...updates,
      id: segmentId, // Preserve ID
      updatedAt: Date.now(),
    };

    this.segments.set(segmentId, updated);
    return updated;
  }

  /**
   * Delete a segment
   */
  deleteSegment(segmentId: string): boolean {
    return this.segments.delete(segmentId);
  }

  /**
   * Evaluate a user against all segments
   */
  async evaluateUser(user: User): Promise<string[]> {
    const matchingSegments: string[] = [];

    for (const segment of this.segments.values()) {
      if (this.evaluator.matchesSegment(user, segment)) {
        matchingSegments.push(segment.id);
      }
    }

    return matchingSegments;
  }

  /**
   * Update segment users
   */
  async updateSegmentUsers(
    segmentId: string,
    users: User[]
  ): Promise<SegmentUpdate> {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    const addedUsers: string[] = [];
    const removedUsers: string[] = [];
    const currentUsers = new Set(segment.users.map((u) => u.userId));

    // Find new matches
    for (const user of users) {
      const matches = this.evaluator.matchesSegment(user, segment);

      if (matches && !currentUsers.has(user.id)) {
        addedUsers.push(user.id);
        const score = this.evaluator.calculateMatchScore(user, segment);
        segment.users.push({
          userId: user.id,
          matchedAt: Date.now(),
          score,
          properties: user.properties,
        });
      } else if (!matches && currentUsers.has(user.id)) {
        removedUsers.push(user.id);
      }
    }

    // Remove unmatched users
    segment.users = segment.users.filter((u) => !removedUsers.includes(u.userId));
    segment.count = segment.users.length;
    segment.updatedAt = Date.now();

    this.segments.set(segmentId, segment);

    return {
      segmentId,
      addedUsers,
      removedUsers,
      timestamp: Date.now(),
    };
  }

  /**
   * Refresh a segment
   */
  async refreshSegment(segmentId: string, users: User[]): Promise<SegmentUpdate> {
    return await this.updateSegmentUsers(segmentId, users);
  }

  /**
   * Refresh all segments
   */
  async refreshAllSegments(users: User[]): Promise<SegmentUpdate[]> {
    const updates: SegmentUpdate[] = [];

    for (const segmentId of this.segments.keys()) {
      const update = await this.refreshSegment(segmentId, users);
      updates.push(update);
    }

    return updates;
  }

  /**
   * Get segment statistics
   */
  getSegmentStats(segmentId: string): SegmentStats | null {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      return null;
    }

    return {
      id: segment.id,
      name: segment.name,
      type: segment.type,
      userCount: segment.count,
      avgScore: this.calculateAverageScore(segment),
      lastRefreshed: segment.updatedAt,
      created: segment.createdAt,
    };
  }

  /**
   * Calculate average match score for a segment
   */
  private calculateAverageScore(segment: Segment): number {
    if (segment.users.length === 0) return 0;

    const totalScore = segment.users.reduce((sum, user) => sum + (user.score || 0), 0);
    return totalScore / segment.users.length;
  }

  /**
   * Find similar segments
   */
  findSimilarSegments(segmentId: string, limit = 5): Segment[] {
    const target = this.segments.get(segmentId);

    if (!target) {
      return [];
    }

    const similarities: Array<{ segment: Segment; similarity: number }> = [];

    for (const segment of this.segments.values()) {
      if (segment.id === segmentId) continue;

      const similarity = this.calculateSegmentSimilarity(target, segment);
      similarities.push({ segment, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((s) => s.segment);
  }

  /**
   * Calculate similarity between two segments
   */
  private calculateSegmentSimilarity(s1: Segment, s2: Segment): number {
    // Simple similarity based on user overlap
    const users1 = new Set(s1.users.map((u) => u.userId));
    const users2 = new Set(s2.users.map((u) => u.userId));

    const intersection = new Set([...users1].filter((u) => users2.has(u)));
    const union = new Set([...users1, ...users2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Export segment data
   */
  exportSegment(segmentId: string, format: 'json' | 'csv'): string {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(segment, null, 2);
    } else {
      return this.exportToCSV(segment);
    }
  }

  /**
   * Export segment to CSV format
   */
  private exportToCSV(segment: Segment): string {
    const headers = ['userId', 'matchedAt', 'score', ...Object.keys(segment.users[0]?.properties || {})];
    const rows = segment.users.map((user) => [
      user.userId,
      user.matchedAt,
      user.score || 0,
      ...Object.values(user.properties || {}),
    ]);

    return [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
  }

  /**
   * Get segment trends over time
   */
  getSegmentTrends(
    segmentId: string,
    period: 'day' | 'week' | 'month',
    buckets: number
  ): SegmentTrend[] {
    const segment = this.segments.get(segmentId);

    if (!segment) {
      return [];
    }

    const now = Date.now();
    const bucketSize = this.getBucketSize(period, buckets);
    const trends: SegmentTrend[] = [];

    for (let i = 0; i < buckets; i++) {
      const bucketStart = now - (buckets - i) * bucketSize;
      const bucketEnd = now - (buckets - i - 1) * bucketSize;

      const usersInBucket = segment.users.filter(
        (u) => u.matchedAt >= bucketStart && u.matchedAt < bucketEnd
      );

      trends.push({
        period: new Date(bucketStart).toISOString(),
        userCount: usersInBucket.length,
        newUsers: usersInBucket.length,
      });
    }

    return trends;
  }

  private getBucketSize(period: 'day' | 'week' | 'month', buckets: number): number {
    const now = Date.now();
    const periodMs =
      period === 'day' ? 24 * 60 * 60 * 1000 :
      period === 'week' ? 7 * 24 * 60 * 60 * 1000 :
      30 * 24 * 60 * 60 * 1000;

    return periodMs / buckets;
  }
}

interface SegmentationConfig {
  maxSegments: number;
  maxUsersPerSegment: number;
  refreshInterval: number;
  enableCaching: boolean;
  cacheTTL: number;
}

interface SegmentStats {
  id: string;
  name: string;
  type: SegmentType;
  userCount: number;
  avgScore: number;
  lastRefreshed: number;
  created: number;
}

interface SegmentTrend {
  period: string;
  userCount: number;
  newUsers: number;
}

// ============================================================================
// Behavioral Segmenter
// ============================================================================

export class BehavioralSegmenter {
  /**
   * Create behavioral segments based on user actions
   */
  createBehavioralSegments(events: AnalyticsEvent[]): Segment[] {
    const segments: Segment[] = [];

    // Power users - high event frequency
    segments.push(this.createPowerUserSegment(events));

    // Churned users - inactive for a period
    segments.push(this.createChurnedUserSegment(events));

    // New users - recently created
    segments.push(this.createNewUserSegment(events));

    // Engaged users - regular activity
    segments.push(this.createEngagedUserSegment(events));

    // At-risk users - declining activity
    segments.push(this.createAtRiskUserSegment(events));

    return segments;
  }

  private createPowerUserSegment(events: AnalyticsEvent[]): Segment {
    const userEventCounts = this.groupEventsByUser(events);
    const avgEvents = this.average(Object.values(userEventCounts));
    const threshold = avgEvents * 2;

    const powerUsers = Object.entries(userEventCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([userId]) => userId);

    return {
      id: 'power_users',
      name: 'Power Users',
      description: 'Users with high activity',
      type: 'behavioral',
      definition: {
        conditions: [
          {
            field: 'totalEvents',
            operator: 'greater_than',
            value: threshold,
            type: 'behavior',
          },
        ],
        logic: 'and',
        refreshInterval: 86400000,
      },
      users: powerUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: powerUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createChurnedUserSegment(events: AnalyticsEvent[]): Segment {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const userLastSeen = this.getLastSeenTimes(events);

    const churnedUsers = Object.entries(userLastSeen)
      .filter(([_, lastSeen]) => lastSeen < thirtyDaysAgo)
      .map(([userId]) => userId);

    return {
      id: 'churned_users',
      name: 'Churned Users',
      description: 'Users inactive for 30+ days',
      type: 'behavioral',
      definition: {
        conditions: [
          {
            field: 'lastSeenAt',
            operator: 'less_than',
            value: thirtyDaysAgo,
            type: 'behavior',
          },
        ],
        logic: 'and',
        refreshInterval: 86400000,
      },
      users: churnedUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: churnedUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createNewUserSegment(events: AnalyticsEvent[]): Segment {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const userFirstSeen = this.getFirstSeenTimes(events);

    const newUsers = Object.entries(userFirstSeen)
      .filter(([_, firstSeen]) => firstSeen >= sevenDaysAgo)
      .map(([userId]) => userId);

    return {
      id: 'new_users',
      name: 'New Users',
      description: 'Users created in the last 7 days',
      type: 'behavioral',
      definition: {
        conditions: [
          {
            field: 'createdAt',
            operator: 'after',
            value: sevenDaysAgo,
            type: 'behavior',
          },
        ],
        logic: 'and',
        refreshInterval: 3600000,
      },
      users: newUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: newUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createEngagedUserSegment(events: AnalyticsEvent[]): Segment {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentEvents = events.filter((e) => e.timestamp >= sevenDaysAgo);
    const userEventCounts = this.groupEventsByUser(recentEvents);
    const threshold = 10; // At least 10 events in 7 days

    const engagedUsers = Object.entries(userEventCounts)
      .filter(([_, count]) => count >= threshold)
      .map(([userId]) => userId);

    return {
      id: 'engaged_users',
      name: 'Engaged Users',
      description: 'Active users in the last 7 days',
      type: 'behavioral',
      definition: {
        conditions: [
          {
            field: 'recentEvents',
            operator: 'greater_than_or_equal',
            value: threshold,
            type: 'behavior',
            timeWindow: {
              value: 7,
              unit: 'days',
            },
          },
        ],
        logic: 'and',
        refreshInterval: 3600000,
      },
      users: engagedUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: engagedUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createAtRiskUserSegment(events: AnalyticsEvent[]): Segment {
    const userTrends = this.calculateUserTrends(events);
    const threshold = -0.5; // 50% decline in activity

    const atRiskUsers = Object.entries(userTrends)
      .filter(([_, trend]) => trend < threshold)
      .map(([userId]) => userId);

    return {
      id: 'at_risk_users',
      name: 'At-Risk Users',
      description: 'Users with declining activity',
      type: 'behavioral',
      definition: {
        conditions: [
          {
            field: 'activityTrend',
            operator: 'less_than',
            value: threshold,
            type: 'behavior',
          },
        ],
        logic: 'and',
        refreshInterval: 86400000,
      },
      users: atRiskUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: atRiskUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private groupEventsByUser(events: AnalyticsEvent[]): Record<string, number> {
    const grouped: Record<string, number> = {};

    for (const event of events) {
      if (event.userId) {
        grouped[event.userId] = (grouped[event.userId] || 0) + 1;
      }
    }

    return grouped;
  }

  private getLastSeenTimes(events: AnalyticsEvent[]): Record<string, number> {
    const lastSeen: Record<string, number> = {};

    for (const event of events) {
      if (event.userId) {
        const current = lastSeen[event.userId] || 0;
        lastSeen[event.userId] = Math.max(current, event.timestamp);
      }
    }

    return lastSeen;
  }

  private getFirstSeenTimes(events: AnalyticsEvent[]): Record<string, number> {
    const firstSeen: Record<string, number> = {};

    for (const event of events) {
      if (event.userId) {
        const current = firstSeen[event.userId] || Infinity;
        firstSeen[event.userId] = Math.min(current, event.timestamp);
      }
    }

    return firstSeen;
  }

  private calculateUserTrends(events: AnalyticsEvent[]): Record<string, number> {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const recentEvents = events.filter((e) => e.timestamp >= weekAgo);
    const olderEvents = events.filter((e) => e.timestamp >= twoWeeksAgo && e.timestamp < weekAgo);

    const recentCounts = this.groupEventsByUser(recentEvents);
    const olderCounts = this.groupEventsByUser(olderEvents);

    const trends: Record<string, number> = {};

    for (const [userId, recentCount] of Object.entries(recentCounts)) {
      const olderCount = olderCounts[userId] || 0;
      if (olderCount > 0) {
        trends[userId] = (recentCount - olderCount) / olderCount;
      }
    }

    return trends;
  }

  private average(values: number[]): number {
    return values.length > 0
      ? values.reduce((sum, v) => sum + v, 0) / values.length
      : 0;
  }
}

// ============================================================================
// Dynamic Segmenter
// ============================================================================

export class DynamicSegmenter {
  /**
   * Create dynamic segments based on real-time data
   */
  async createDynamicSegments(
    users: User[],
    events: AnalyticsEvent[]
  ): Promise<Segment[]> {
    const segments: Segment[] = [];

    // Active now segment
    segments.push(this.createActiveNowSegment(events));

    // High value segment
    segments.push(this.createHighValueSegment(users));

    // Premium users segment
    segments.push(this.createPremiumUsersSegment(users));

    // Mobile users segment
    segments.push(this.createMobileUsersSegment(events));

    // Desktop users segment
    segments.push(this.createDesktopUsersSegment(events));

    return segments;
  }

  private createActiveNowSegment(events: AnalyticsEvent[]): Segment {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const activeUsers = new Set(
      events
        .filter((e) => e.timestamp >= fiveMinutesAgo)
        .map((e) => e.userId)
        .filter(Boolean) as string[]
    );

    return {
      id: 'active_now',
      name: 'Active Now',
      description: 'Users active in the last 5 minutes',
      type: 'dynamic',
      definition: {
        conditions: [
          {
            field: 'lastActivity',
            operator: 'after',
            value: fiveMinutesAgo,
            type: 'behavior',
            timeWindow: {
              value: 5,
              unit: 'minutes',
            },
          },
        ],
        logic: 'and',
        refreshInterval: 60000, // 1 minute
      },
      users: Array.from(activeUsers).map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: activeUsers.size,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createHighValueSegment(users: User[]): Segment {
    const highValueUsers = users
      .filter((u) => (u.lifetimeValue || 0) > 1000)
      .map((u) => u.id);

    return {
      id: 'high_value',
      name: 'High Value Users',
      description: 'Users with LTV > $1000',
      type: 'dynamic',
      definition: {
        conditions: [
          {
            field: 'lifetimeValue',
            operator: 'greater_than',
            value: 1000,
            type: 'property',
          },
        ],
        logic: 'and',
        refreshInterval: 3600000,
      },
      users: highValueUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: highValueUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createPremiumUsersSegment(users: User[]): Segment {
    const premiumUsers = users
      .filter((u) => u.properties.subscription === 'premium')
      .map((u) => u.id);

    return {
      id: 'premium_users',
      name: 'Premium Users',
      description: 'Users with premium subscription',
      type: 'dynamic',
      definition: {
        conditions: [
          {
            field: 'properties.subscription',
            operator: 'equals',
            value: 'premium',
            type: 'property',
          },
        ],
        logic: 'and',
        refreshInterval: 3600000,
      },
      users: premiumUsers.map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: premiumUsers.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createMobileUsersSegment(events: AnalyticsEvent[]): Segment {
    const mobileUsers = new Set(
      events
        .filter((e) => e.context.platform === 'mobile')
        .map((e) => e.userId)
        .filter(Boolean) as string[]
    );

    return {
      id: 'mobile_users',
      name: 'Mobile Users',
      description: 'Users on mobile devices',
      type: 'dynamic',
      definition: {
        conditions: [
          {
            field: 'context.platform',
            operator: 'equals',
            value: 'mobile',
            type: 'behavior',
          },
        ],
        logic: 'and',
        refreshInterval: 3600000,
      },
      users: Array.from(mobileUsers).map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: mobileUsers.size,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private createDesktopUsersSegment(events: AnalyticsEvent[]): Segment {
    const desktopUsers = new Set(
      events
        .filter((e) => e.context.platform === 'desktop')
        .map((e) => e.userId)
        .filter(Boolean) as string[]
    );

    return {
      id: 'desktop_users',
      name: 'Desktop Users',
      description: 'Users on desktop devices',
      type: 'dynamic',
      definition: {
        conditions: [
          {
            field: 'context.platform',
            operator: 'equals',
            value: 'desktop',
            type: 'behavior',
          },
        ],
        logic: 'and',
        refreshInterval: 3600000,
      },
      users: Array.from(desktopUsers).map((userId) => ({
        userId,
        matchedAt: Date.now(),
      })),
      count: desktopUsers.size,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
