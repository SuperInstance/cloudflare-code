/**
 * Behavioral Analyzer
 * Detects threats by analyzing user and entity behavior patterns
 */

import { Cache } from '@claudeflare/cache';
import { Client } from '@elastic/elasticsearch';

import {
  Threat,
  ThreatType,
  ThreatLevel,
  SecurityEventSeverity,
  EnrichedSecurityEvent,
  DetectionRule,
} from '../types';

export interface BehavioralAnalyzerConfig {
  cache: Cache;
  elasticsearch: Client;
  baselineWindow?: number; // days
}

export class BehavioralAnalyzer {
  private config: Required<BehavioralAnalyzerConfig>;
  private rules: DetectionRule[] = [];

  constructor(config: BehavioralAnalyzerConfig) {
    this.config = {
      baselineWindow: 30,
      ...config,
    };
  }

  /**
   * Detect threats using behavioral analysis
   */
  public async detect(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    // Analyze user behavior
    if (event.userId) {
      const userThreats = await this.analyzeUserBehavior(event);
      threats.push(...userThreats);
    }

    // Analyze IP behavior
    if (event.ipAddress) {
      const ipThreats = await this.analyzeIPBehavior(event);
      threats.push(...ipThreats);
    }

    // Analyze session behavior
    if (event.sessionId) {
      const sessionThreats = await this.analyzeSessionBehavior(event);
      threats.push(...sessionThreats);
    }

    // Check behavioral rules
    for (const rule of this.rules.filter(r => r.enabled)) {
      if (await this.matchesBehavioralRule(event, rule)) {
        const threat = await this.createThreatFromBehavior(event, rule);
        threats.push(threat);
      }
    }

    return threats;
  }

  /**
   * Analyze user behavior
   */
  private async analyzeUserBehavior(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    if (!event.userId) {
      return threats;
    }

    // Get user baseline
    const baseline = await this.getUserBaseline(event.userId);

    if (!baseline) {
      return threats;
    }

    // Check for unusual login times
    if (event.type.includes('auth.login')) {
      const unusualTimeThreat = await this.checkUnusualLoginTime(event, baseline);
      if (unusualTimeThreat) {
        threats.push(unusualTimeThreat);
      }
    }

    // Check for unusual locations
    if (event.enrichmentData?.geoLocation) {
      const unusualLocationThreat = await this.checkUnusualLocation(event, baseline);
      if (unusualLocationThreat) {
        threats.push(unusualLocationThreat);
      }
    }

    // Check for unusual access patterns
    const unusualAccessThreat = await this.checkUnusualAccessPattern(event, baseline);
    if (unusualAccessThreat) {
      threats.push(unusualAccessThreat);
    }

    // Check for rapid actions
    const rapidActionsThreat = await this.checkRapidActions(event, baseline);
    if (rapidActionsThreat) {
      threats.push(rapidActionsThreat);
    }

    return threats;
  }

  /**
   * Get user baseline behavior
   */
  private async getUserBaseline(userId: string): Promise<UserBaseline | null> {
    try {
      const cacheKey = `baseline:user:${userId}`;
      const cached = await this.config.cache.get<UserBaseline>(cacheKey);

      if (cached) {
        return cached;
      }

      // Calculate baseline from historical data
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - this.config.baselineWindow);

      const response = await this.config.elasticsearch.search({
        index: 'security-events-*',
        body: {
          query: {
            bool: {
              must: [
                { term: { userId } },
                {
                  range: {
                    timestamp: {
                      gte: startTime,
                    },
                  },
                },
              ],
            },
          },
          aggs: {
            by_hour: {
              terms: {
                script: {
                  source: "doc.timestamp.value.hourOfDay",
                  lang: "painless",
                },
                size: 24,
              },
            },
            by_day: {
              terms: {
                script: {
                  source: "doc.timestamp.value.dayOfWeek",
                  lang: "painless",
                },
                size: 7,
              },
            },
            unique_locations: {
              cardinality: {
                field: 'enrichmentData.geoLocation.country',
              },
            },
            avg_actions_per_session: {
              avg: {
                field: 'action',
              },
            },
          },
          size: 0,
        },
      });

      const aggs = response.body.aggregations;
      const hourBuckets = aggs.by_hour.buckets;
      const dayBuckets = aggs.by_day.buckets;

      const baseline: UserBaseline = {
        userId,
        hourlyDistribution: {},
        dailyDistribution: {},
        uniqueLocations: aggs.unique_locations.value,
        avgActionsPerSession: aggs.avg_actions_per_session.value || 0,
        updatedAt: new Date(),
      };

      hourBuckets.forEach((bucket: any) => {
        baseline.hourlyDistribution[bucket.key] = bucket.doc_count;
      });

      dayBuckets.forEach((bucket: any) => {
        baseline.dailyDistribution[bucket.key] = bucket.doc_count;
      });

      // Cache for 1 hour
      await this.config.cache.set(cacheKey, baseline, 3600);

      return baseline;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for unusual login times
   */
  private async checkUnusualLoginTime(
    event: EnrichedSecurityEvent,
    baseline: UserBaseline
  ): Promise<Threat | null> {
    const hour = event.timestamp.getHours();
    const hourCount = baseline.hourlyDistribution[hour] || 0;
    const totalHours = Object.values(baseline.hourlyDistribution).reduce((a, b) => a + b, 0);
    const hourRatio = totalHours > 0 ? hourCount / totalHours : 0;

    // If this hour represents less than 5% of user's activity
    if (hourRatio < 0.05 && totalHours > 100) {
      return {
        id: `threat_behavior_time_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: ThreatType.UNKNOWN,
        level: ThreatLevel.LOW,
        severity: SecurityEventSeverity.LOW,
        status: 'detected',
        timestamp: new Date(),
        source: event.source,
        description: `Unusual login time: ${hour}:00 (usually ${((hourRatio * 100).toFixed(1))}% of activity)`,
        indicators: [],
        affectedAssets: [event.userId],
        eventId: event.id,
        confidence: 0.6,
        falsePositiveScore: 0.4,
        metadata: {
          behaviorType: 'unusual_time',
          hour,
          hourRatio,
        },
      };
    }

    return null;
  }

  /**
   * Check for unusual locations
   */
  private async checkUnusualLocation(
    event: EnrichedSecurityEvent,
    baseline: UserBaseline
  ): Promise<Threat | null> {
    if (!event.enrichmentData?.geoLocation) {
      return null;
    }

    const geoLocation = event.enrichmentData.geoLocation;
    const cacheKey = `user:locations:${event.userId}`;

    try {
      const knownLocations = await this.config.cache.get<Set<string>>(cacheKey);
      const locationKey = `${geoLocation.country},${geoLocation.city}`;

      if (knownLocations && !knownLocations.has(locationKey)) {
        return {
          id: `threat_behavior_loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: ThreatType.UNKNOWN,
          level: ThreatLevel.MEDIUM,
          severity: SecurityEventSeverity.MEDIUM,
          status: 'detected',
          timestamp: new Date(),
          source: event.source,
          description: `Unusual location: ${geoLocation.city}, ${geoLocation.country}`,
          indicators: [],
          affectedAssets: [event.userId],
          eventId: event.id,
          confidence: 0.7,
          falsePositiveScore: 0.3,
          metadata: {
            behaviorType: 'unusual_location',
            location: locationKey,
            geoLocation,
          },
        };
      }
    } catch (error) {
      // Ignore
    }

    return null;
  }

  /**
   * Check for unusual access patterns
   */
  private async checkUnusualAccessPattern(
    event: EnrichedSecurityEvent,
    baseline: UserBaseline
  ): Promise<Threat | null> {
    // Check if user is accessing resources they don't normally access
    const resource = event.resource;

    if (!resource) {
      return null;
    }

    try {
      const cacheKey = `user:resources:${event.userId}`;
      const resourceCounts = await this.config.cache.get<Record<string, number>>(cacheKey);

      if (resourceCounts) {
        const totalCounts = Object.values(resourceCounts).reduce((a, b) => a + b, 0);
        const resourceCount = resourceCounts[resource] || 0;
        const resourceRatio = totalCounts > 0 ? resourceCount / totalCounts : 0;

        // If user has accessed this resource less than 1% of the time
        if (resourceRatio < 0.01 && totalCounts > 100) {
          return {
            id: `threat_behavior_access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: ThreatType.UNKNOWN,
            level: ThreatLevel.LOW,
            severity: SecurityEventSeverity.LOW,
            status: 'detected',
            timestamp: new Date(),
            source: event.source,
            description: `Unusual access pattern: resource '${resource}'`,
            indicators: [],
            affectedAssets: [event.userId, resource],
            eventId: event.id,
            confidence: 0.5,
            falsePositiveScore: 0.5,
            metadata: {
              behaviorType: 'unusual_access',
              resource,
              resourceRatio,
            },
          };
        }
      }
    } catch (error) {
      // Ignore
    }

    return null;
  }

  /**
   * Check for rapid actions
   */
  private async checkRapidActions(
    event: EnrichedSecurityEvent,
    baseline: UserBaseline
  ): Promise<Threat | null> {
    try {
      const cacheKey = `user:actions:rate:${event.userId}`;
      const recentActions = await this.config.cache.get<number>(cacheKey);

      if (recentActions && recentActions > 100) {
        // More than 100 actions in the last minute
        return {
          id: `threat_behavior_rapid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: ThreatType.UNKNOWN,
          level: ThreatLevel.HIGH,
          severity: SecurityEventSeverity.HIGH,
          status: 'detected',
          timestamp: new Date(),
          source: event.source,
          description: `Rapid actions detected: ${recentActions} actions in last minute`,
          indicators: [],
          affectedAssets: [event.userId],
          eventId: event.id,
          confidence: 0.8,
          falsePositiveScore: 0.2,
          metadata: {
            behaviorType: 'rapid_actions',
            actionCount: recentActions,
          },
        };
      }
    } catch (error) {
      // Ignore
    }

    return null;
  }

  /**
   * Analyze IP behavior
   */
  private async analyzeIPBehavior(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    if (!event.ipAddress) {
      return threats;
    }

    // Check for multiple failed logins from same IP
    const failedLoginsThreat = await this.checkMultipleFailedLogins(event);
    if (failedLoginsThreat) {
      threats.push(failedLoginsThreat);
    }

    // Check for attacks from same IP
    const attackThreat = await this.checkAttackIP(event);
    if (attackThreat) {
      threats.push(attackThreat);
    }

    return threats;
  }

  /**
   * Check for multiple failed logins from same IP
   */
  private async checkMultipleFailedLogins(event: EnrichedSecurityEvent): Promise<Threat | null> {
    if (!event.ipAddress || event.type !== 'auth.login.failure') {
      return null;
    }

    try {
      const cacheKey = `ip:failed_logins:${event.ipAddress}`;
      let failedCount = await this.config.cache.get<number>(cacheKey) || 0;
      failedCount++;

      await this.config.cache.set(cacheKey, failedCount, 300); // 5 minutes

      if (failedCount >= 10) {
        return {
          id: `threat_behavior_ip_failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: ThreatType.BRUTE_FORCE,
          level: ThreatLevel.HIGH,
          severity: SecurityEventSeverity.HIGH,
          status: 'detected',
          timestamp: new Date(),
          source: event.source,
          description: `Multiple failed logins from IP: ${failedCount} attempts`,
          indicators: [],
          affectedAssets: [event.ipAddress],
          eventId: event.id,
          confidence: 0.9,
          falsePositiveScore: 0.1,
          metadata: {
            behaviorType: 'brute_force',
            failedCount,
            ipAddress: event.ipAddress,
          },
        };
      }
    } catch (error) {
      // Ignore
    }

    return null;
  }

  /**
   * Check for attack IP
   */
  private async checkAttackIP(event: EnrichedSecurityEvent): Promise<Threat | null> {
    if (!event.ipAddress) {
      return null;
    }

    try {
      const cacheKey = `ip:threats:${event.ipAddress}`;
      const threatCount = await this.config.cache.get<number>(cacheKey) || 0;

      if (threatCount >= 5) {
        return {
          id: `threat_behavior_ip_attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: ThreatType.UNKNOWN,
          level: ThreatLevel.CRITICAL,
          severity: SecurityEventSeverity.CRITICAL,
          status: 'detected',
          timestamp: new Date(),
          source: event.source,
          description: `Attack pattern detected from IP: ${event.ipAddress}`,
          indicators: [],
          affectedAssets: [event.ipAddress],
          eventId: event.id,
          confidence: 0.95,
          falsePositiveScore: 0.05,
          metadata: {
            behaviorType: 'attack_ip',
            threatCount,
            ipAddress: event.ipAddress,
          },
        };
      }
    } catch (error) {
      // Ignore
    }

    return null;
  }

  /**
   * Analyze session behavior
   */
  private async analyzeSessionBehavior(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    if (!event.sessionId) {
      return threats;
    }

    // Check for session hijacking indicators
    const hijackThreat = await this.checkSessionHijacking(event);
    if (hijackThreat) {
      threats.push(hijackThreat);
    }

    return threats;
  }

  /**
   * Check for session hijacking
   */
  private async checkSessionHijacking(event: EnrichedSecurityEvent): Promise<Threat | null> {
    if (!event.sessionId || !event.ipAddress) {
      return null;
    }

    try {
      const cacheKey = `session:ips:${event.sessionId}`;
      const sessionIPs = await this.config.cache.get<Set<string>>(cacheKey);

      if (sessionIPs && sessionIPs.size > 1) {
        // Session has been used from multiple IPs
        return {
          id: `threat_behavior_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: ThreatType.UNKNOWN,
          level: ThreatLevel.HIGH,
          severity: SecurityEventSeverity.HIGH,
          status: 'detected',
          timestamp: new Date(),
          source: event.source,
          description: `Session hijacking suspected: session used from multiple IPs`,
          indicators: [],
          affectedAssets: [event.sessionId],
          eventId: event.id,
          confidence: 0.7,
          falsePositiveScore: 0.3,
          metadata: {
            behaviorType: 'session_hijacking',
            sessionId: event.sessionId,
            ipCount: sessionIPs.size,
          },
        };
      }
    } catch (error) {
      // Ignore
    }

    return null;
  }

  /**
   * Check if event matches behavioral rule
   */
  private async matchesBehavioralRule(event: EnrichedSecurityEvent, rule: DetectionRule): Promise<boolean> {
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(event, condition.field);

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'in':
          if (!Array.isArray(condition.value) || !condition.value.includes(value)) return false;
          break;
        default:
          break;
      }
    }

    return true;
  }

  /**
   * Get field value from event
   */
  private getFieldValue(event: EnrichedSecurityEvent, field: string): any {
    const parts = field.split('.');
    let value: any = event;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Create threat from behavior
   */
  private async createThreatFromBehavior(event: EnrichedSecurityEvent, rule: DetectionRule): Promise<Threat> {
    return {
      id: `threat_behavior_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ThreatType.UNKNOWN,
      level: this.mapSeverityToLevel(rule.severity),
      severity: rule.severity,
      status: 'detected',
      timestamp: new Date(),
      source: event.source,
      description: rule.description,
      indicators: [],
      affectedAssets: [event.userId || event.ipAddress || 'unknown'],
      eventId: event.id,
      confidence: 1 - rule.falsePositiveRate,
      falsePositiveScore: rule.falsePositiveRate,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
      },
    };
  }

  /**
   * Map severity to threat level
   */
  private mapSeverityToLevel(severity: SecurityEventSeverity): ThreatLevel {
    const levelMap: Record<SecurityEventSeverity, ThreatLevel> = {
      [SecurityEventSeverity.CRITICAL]: ThreatLevel.CRITICAL,
      [SecurityEventSeverity.HIGH]: ThreatLevel.HIGH,
      [SecurityEventSeverity.MEDIUM]: ThreatLevel.MEDIUM,
      [SecurityEventSeverity.LOW]: ThreatLevel.LOW,
      [SecurityEventSeverity.INFO]: ThreatLevel.MINIMAL,
    };

    return levelMap[severity];
  }

  /**
   * Update rules
   */
  public async updateRules(rules: DetectionRule[]): Promise<void> {
    this.rules = rules.filter(r => r.type === 'behavioral');
  }
}

interface UserBaseline {
  userId: string;
  hourlyDistribution: Record<number, number>;
  dailyDistribution: Record<number, number>;
  uniqueLocations: number;
  avgActionsPerSession: number;
  updatedAt: Date;
}
