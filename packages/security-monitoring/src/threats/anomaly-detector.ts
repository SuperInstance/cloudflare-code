/**
 * Anomaly Detector
 * Detects threats using statistical analysis and anomaly detection
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

export interface AnomalyDetectorConfig {
  cache: Cache;
  elasticsearch: Client;
  window?: number; // seconds
  threshold?: number;
}

export class AnomalyDetector {
  private config: Required<AnomalyDetectorConfig>;
  private rules: DetectionRule[] = [];

  constructor(config: AnomalyDetectorConfig) {
    this.config = {
      window: 3600,
      threshold: 3, // Standard deviations
      ...config,
    };
  }

  /**
   * Detect threats using anomaly detection
   */
  public async detect(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    // Check for statistical anomalies
    const statisticalAnomalies = await this.detectStatisticalAnomalies(event);
    threats.push(...statisticalAnomalies);

    // Check for frequency anomalies
    const frequencyAnomalies = await this.detectFrequencyAnomalies(event);
    threats.push(...frequencyAnomalies);

    // Check for pattern anomalies
    const patternAnomalies = await this.detectPatternAnomalies(event);
    threats.push(...patternAnomalies);

    // Check rules
    for (const rule of this.rules.filter(r => r.enabled)) {
      if (await this.matchesAnomalyRule(event, rule)) {
        const threat = await this.createThreatFromAnomaly(event, rule, 'rule');
        threats.push(threat);
      }
    }

    return threats;
  }

  /**
   * Detect statistical anomalies
   */
  private async detectStatisticalAnomalies(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    try {
      // Calculate baseline statistics
      const stats = await this.getBaselineStatistics(event);

      if (!stats) {
        return threats;
      }

      // Check for deviations
      if (stats.mean && stats.stdDev) {
        const zScore = Math.abs((event.riskScore - stats.mean) / stats.stdDev);

        if (zScore > this.config.threshold) {
          threats.push({
            id: `threat_anomaly_stat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: ThreatType.UNKNOWN,
            level: this.getLevelFromZScore(zScore),
            severity: this.getSeverityFromZScore(zScore),
            status: 'detected',
            timestamp: new Date(),
            source: event.source,
            description: `Statistical anomaly detected: z-score of ${zScore.toFixed(2)}`,
            indicators: [],
            affectedAssets: [event.resource || event.userId || 'unknown'],
            eventId: event.id,
            confidence: Math.min(1, zScore / this.config.threshold),
            falsePositiveScore: 0.3,
            metadata: {
              anomalyType: 'statistical',
              zScore,
              mean: stats.mean,
              stdDev: stats.stdDev,
              value: event.riskScore,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error detecting statistical anomalies:', error);
    }

    return threats;
  }

  /**
   * Detect frequency anomalies
   */
  private async detectFrequencyAnomalies(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    try {
      // Get event frequency for this type
      const frequency = await this.getEventFrequency(event.type);

      if (frequency && frequency.count > 0) {
        const expectedRate = frequency.averageRate || 0;
        const currentRate = frequency.count / (this.config.window / 60); // per minute

        // Check if rate is significantly higher than normal
        if (expectedRate > 0 && currentRate > expectedRate * 5) {
          threats.push({
            id: `threat_anomaly_freq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: ThreatType.DDOS,
            level: ThreatLevel.HIGH,
            severity: SecurityEventSeverity.HIGH,
            status: 'detected',
            timestamp: new Date(),
            source: event.source,
            description: `Frequency anomaly detected: ${currentRate.toFixed(2)} events/min vs expected ${expectedRate.toFixed(2)}`,
            indicators: [],
            affectedAssets: [event.resource || event.userId || 'unknown'],
            eventId: event.id,
            confidence: Math.min(1, currentRate / (expectedRate * 10)),
            falsePositiveScore: 0.2,
            metadata: {
              anomalyType: 'frequency',
              currentRate,
              expectedRate,
              ratio: currentRate / expectedRate,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error detecting frequency anomalies:', error);
    }

    return threats;
  }

  /**
   * Detect pattern anomalies
   */
  private async detectPatternAnomalies(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    try {
      // Check for sequential patterns
      const sequentialPattern = await this.detectSequentialPattern(event);
      if (sequentialPattern) {
        threats.push(sequentialPattern);
      }

      // Check for temporal patterns
      const temporalPattern = await this.detectTemporalPattern(event);
      if (temporalPattern) {
        threats.push(temporalPattern);
      }
    } catch (error) {
      console.error('Error detecting pattern anomalies:', error);
    }

    return threats;
  }

  /**
   * Detect sequential patterns
   */
  private async detectSequentialPattern(event: EnrichedSecurityEvent): Promise<Threat | null> {
    try {
      // Get recent events from the same user/IP
      const recentEvents = await this.getRecentEvents(event);

      if (recentEvents.length < 5) {
        return null;
      }

      // Check for repeated actions
      const actionCounts = new Map<string, number>();
      recentEvents.forEach(e => {
        if (e.action) {
          actionCounts.set(e.action, (actionCounts.get(e.action) || 0) + 1);
        }
      });

      for (const [action, count] of actionCounts.entries()) {
        if (count >= 10) {
          return {
            id: `threat_anomaly_seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: ThreatType.BRUTE_FORCE,
            level: ThreatLevel.HIGH,
            severity: SecurityEventSeverity.HIGH,
            status: 'detected',
            timestamp: new Date(),
            source: event.source,
            description: `Sequential pattern detected: action '${action}' repeated ${count} times`,
            indicators: [],
            affectedAssets: [event.resource || event.userId || 'unknown'],
            eventId: event.id,
            confidence: 0.8,
            falsePositiveScore: 0.25,
            metadata: {
              anomalyType: 'sequential',
              action,
              count,
            },
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Detect temporal patterns
   */
  private async detectTemporalPattern(event: EnrichedSecurityEvent): Promise<Threat | null> {
    try {
      // Check if event is happening at an unusual time
      const hour = event.timestamp.getHours();
      const unusualHours = [0, 1, 2, 3, 4, 5, 6, 22, 23];

      if (unusualHours.includes(hour)) {
        // Check if this user typically operates at this time
        const userHistory = await this.getUserHourlyHistory(event.userId);

        if (userHistory && userHistory[hour] < 5) {
          return {
            id: `threat_anomaly_temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: ThreatType.UNKNOWN,
            level: ThreatLevel.MEDIUM,
            severity: SecurityEventSeverity.MEDIUM,
            status: 'detected',
            timestamp: new Date(),
            source: event.source,
            description: `Temporal pattern detected: activity at unusual hour (${hour}:00)`,
            indicators: [],
            affectedAssets: [event.resource || event.userId || 'unknown'],
            eventId: event.id,
            confidence: 0.6,
            falsePositiveScore: 0.4,
            metadata: {
              anomalyType: 'temporal',
              hour,
              userHistoryCount: userHistory[hour],
            },
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get baseline statistics for event type
   */
  private async getBaselineStatistics(event: EnrichedSecurityEvent): Promise<{
    mean: number;
    stdDev: number;
  } | null> {
    try {
      const cacheKey = `stats:baseline:${event.type}`;
      const cached = await this.config.cache.get<any>(cacheKey);

      if (cached) {
        return cached;
      }

      // Calculate from historical data
      const response = await this.config.elasticsearch.search({
        index: 'security-events-*',
        body: {
          query: {
            term: { type: event.type },
          },
          aggs: {
            stats: {
              extended_stats: {
                field: 'riskScore',
              },
            },
          },
          size: 0,
        },
      });

      const stats = response.body.aggregations.stats;
      const result = {
        mean: stats.avg,
        stdDev: stats.std_deviation,
      };

      // Cache for 1 hour
      await this.config.cache.set(cacheKey, result, 3600);

      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get event frequency
   */
  private async getEventFrequency(type: string): Promise<{
    count: number;
    averageRate: number;
  } | null> {
    try {
      const cacheKey = `freq:${type}`;
      const cached = await this.config.cache.get<any>(cacheKey);

      if (cached) {
        return cached;
      }

      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - this.config.window * 1000);

      const response = await this.config.elasticsearch.search({
        index: 'security-events-*',
        body: {
          query: {
            bool: {
              must: [
                { term: { type } },
                {
                  range: {
                    timestamp: {
                      gte: startTime,
                      lte: endTime,
                    },
                  },
                },
              ],
            },
          },
          size: 0,
        },
      });

      const count = response.body.hits.total.value;
      const result = {
        count,
        averageRate: count / (this.config.window / 60), // per minute
      };

      // Cache for 5 minutes
      await this.config.cache.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get recent events
   */
  private async getRecentEvents(event: EnrichedSecurityEvent): Promise<EnrichedSecurityEvent[]> {
    try {
      const must: any[] = [];

      if (event.userId) {
        must.push({ term: { userId: event.userId } });
      }

      if (event.ipAddress) {
        must.push({ term: { ipAddress: event.ipAddress } });
      }

      if (must.length === 0) {
        return [];
      }

      const startTime = new Date(Date.now() - 300000); // Last 5 minutes

      const response = await this.config.elasticsearch.search({
        index: 'security-events-*',
        body: {
          query: {
            bool: {
              must,
              must_not: [
                { term: { id: event.id } },
              ],
            },
          },
          sort: [
            { timestamp: { order: 'desc' } },
          ],
          size: 100,
        },
      });

      return response.body.hits.hits.map((hit: any) => hit._source);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user hourly history
   */
  private async getUserHourlyHistory(userId: string): Promise<Record<number, number> | null> {
    try {
      const cacheKey = `user:hours:${userId}`;
      const cached = await this.config.cache.get<Record<number, number>>(cacheKey);

      if (cached) {
        return cached;
      }

      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 30); // Last 30 days

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
          },
          size: 0,
        },
      });

      const buckets = response.body.aggregations.by_hour.buckets;
      const result: Record<number, number> = {};

      buckets.forEach((bucket: any) => {
        result[bucket.key] = bucket.doc_count;
      });

      // Cache for 1 hour
      await this.config.cache.set(cacheKey, result, 3600);

      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if event matches anomaly rule
   */
  private async matchesAnomalyRule(event: EnrichedSecurityEvent, rule: DetectionRule): Promise<boolean> {
    // Similar to pattern detector but with anomaly-specific logic
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
          // Other operators not typically used for anomaly detection
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
   * Create threat from anomaly
   */
  private async createThreatFromAnomaly(
    event: EnrichedSecurityEvent,
    rule: DetectionRule,
    anomalyType: string
  ): Promise<Threat> {
    return {
      id: `threat_${anomalyType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ThreatType.UNKNOWN,
      level: this.mapSeverityToLevel(rule.severity),
      severity: rule.severity,
      status: 'detected',
      timestamp: new Date(),
      source: event.source,
      description: rule.description,
      indicators: [],
      affectedAssets: [event.resource || event.userId || 'unknown'],
      eventId: event.id,
      confidence: 1 - rule.falsePositiveRate,
      falsePositiveScore: rule.falsePositiveRate,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        anomalyType,
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
   * Get level from z-score
   */
  private getLevelFromZScore(zScore: number): ThreatLevel {
    if (zScore >= 5) return ThreatLevel.CRITICAL;
    if (zScore >= 4) return ThreatLevel.HIGH;
    if (zScore >= 3) return ThreatLevel.MEDIUM;
    if (zScore >= 2) return ThreatLevel.LOW;
    return ThreatLevel.MINIMAL;
  }

  /**
   * Get severity from z-score
   */
  private getSeverityFromZScore(zScore: number): SecurityEventSeverity {
    if (zScore >= 5) return SecurityEventSeverity.CRITICAL;
    if (zScore >= 4) return SecurityEventSeverity.HIGH;
    if (zScore >= 3) return SecurityEventSeverity.MEDIUM;
    if (zScore >= 2) return SecurityEventSeverity.LOW;
    return SecurityEventSeverity.INFO;
  }

  /**
   * Update rules
   */
  public async updateRules(rules: DetectionRule[]): Promise<void> {
    this.rules = rules.filter(r => r.type === 'anomaly');
  }
}
