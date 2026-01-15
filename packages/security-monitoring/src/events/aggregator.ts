/**
 * Event Aggregator
 * Aggregates security events for analytics and reporting
 */

import { Client } from '@elastic/elasticsearch';
import { SecurityEvent, SecurityEventType, SecurityEventSeverity } from '../types';
import { TimelineBucket } from './logger';

export class EventAggregator {
  private elasticsearch: Client;

  constructor(elasticsearch: Client) {
    this.elasticsearch = elasticsearch;
  }

  /**
   * Get event counts by type
   */
  public async getEventCountsByType(
    startDate: Date,
    endDate: Date
  ): Promise<Record<SecurityEventType, number>> {
    const response = await this.elasticsearch.search({
      index: 'security-events-*',
      body: {
        query: {
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        aggs: {
          by_type: {
            terms: {
              field: 'type',
              size: 1000,
            },
          },
        },
        size: 0,
      },
    });

    const counts: Record<string, number> = {};
    const buckets = response.body.aggregations.by_type.buckets;

    buckets.forEach((bucket: any) => {
      counts[bucket.key] = bucket.doc_count;
    });

    return counts as Record<SecurityEventType, number>;
  }

  /**
   * Get event counts by severity
   */
  public async getEventCountsBySeverity(
    startDate: Date,
    endDate: Date
  ): Promise<Record<SecurityEventSeverity, number>> {
    const response = await this.elasticsearch.search({
      index: 'security-events-*',
      body: {
        query: {
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        aggs: {
          by_severity: {
            terms: {
              field: 'severity',
              size: 10,
            },
          },
        },
        size: 0,
      },
    });

    const counts: Record<string, number> = {};
    const buckets = response.body.aggregations.by_severity.buckets;

    buckets.forEach((bucket: any) => {
      counts[bucket.key] = bucket.doc_count;
    });

    return counts as Record<SecurityEventSeverity, number>;
  }

  /**
   * Get event timeline
   */
  public async getEventTimeline(
    startDate: Date,
    endDate: Date,
    interval: 'minute' | 'hour' | 'day' | 'week' | 'month' = 'hour'
  ): Promise<TimelineBucket[]> {
    const response = await this.elasticsearch.search({
      index: 'security-events-*',
      body: {
        query: {
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        aggs: {
          timeline: {
            date_histogram: {
              field: 'timestamp',
              fixed_interval: this.getIntervalValue(interval),
              min_doc_count: 0,
            },
            aggs: {
              by_type: {
                terms: {
                  field: 'type',
                  size: 100,
                },
              },
              by_severity: {
                terms: {
                  field: 'severity',
                  size: 10,
                },
              },
            },
          },
        },
        size: 0,
      },
    });

    const buckets = response.body.aggregations.timeline.buckets;

    return buckets.map((bucket: any) => ({
      timestamp: new Date(bucket.key_as_string),
      count: bucket.doc_count,
      byType: this.formatTermCounts(bucket.by_type.buckets),
      bySeverity: this.formatTermCounts(bucket.by_severity.buckets),
    }));
  }

  /**
   * Get top events by frequency
   */
  public async getTopEvents(
    startDate: Date,
    endDate: Date,
    limit: number = 10
  ): Promise<Array<{ type: SecurityEventType; count: number }>> {
    const response = await this.elasticsearch.search({
      index: 'security-events-*',
      body: {
        query: {
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        aggs: {
          top_events: {
            terms: {
              field: 'type',
              size: limit,
            },
          },
        },
        size: 0,
      },
    });

    const buckets = response.body.aggregations.top_events.buckets;

    return buckets.map((bucket: any) => ({
      type: bucket.key as SecurityEventType,
      count: bucket.doc_count,
    }));
  }

  /**
   * Get event statistics
   */
  public async getEventStatistics(
    startDate: Date,
    endDate: Date
  ): Promise<EventStatistics> {
    const response = await this.elasticsearch.search({
      index: 'security-events-*',
      body: {
        query: {
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        aggs: {
          total_events: {
            value_count: {
              field: '_id',
            },
          },
          unique_users: {
            cardinality: {
              field: 'userId',
            },
          },
          unique_ips: {
            cardinality: {
              field: 'ipAddress',
            },
          },
          unique_sources: {
            cardinality: {
              field: 'source',
            },
          },
          avg_risk_score: {
            avg: {
              field: 'riskScore',
            },
          },
          max_risk_score: {
            max: {
              field: 'riskScore',
            },
          },
        },
        size: 0,
      },
    });

    const aggs = response.body.aggregations;

    return {
      totalEvents: aggs.total_events.value,
      uniqueUsers: aggs.unique_users.value,
      uniqueIPs: aggs.unique_ips.value,
      uniqueSources: aggs.unique_sources.value,
      averageRiskScore: aggs.avg_risk_score.value || 0,
      maxRiskScore: aggs.max_risk_score.value || 0,
    };
  }

  /**
   * Get risk distribution
   */
  public async getRiskDistribution(
    startDate: Date,
    endDate: Date
  ): Promise<RiskDistribution> {
    const response = await this.elasticsearch.search({
      index: 'security-events-*',
      body: {
        query: {
          range: {
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
        aggs: {
          risk_ranges: {
            range: {
              field: 'riskScore',
              ranges: [
                { to: 10, key: 'very_low' },
                { from: 10, to: 25, key: 'low' },
                { from: 25, to: 50, key: 'medium' },
                { from: 50, to: 75, key: 'high' },
                { from: 75, key: 'critical' },
              ],
            },
          },
        },
        size: 0,
      },
    });

    const buckets = response.body.aggregations.risk_ranges.buckets;

    return {
      veryLow: buckets.find((b: any) => b.key === 'very_low')?.doc_count || 0,
      low: buckets.find((b: any) => b.key === 'low')?.doc_count || 0,
      medium: buckets.find((b: any) => b.key === 'medium')?.doc_count || 0,
      high: buckets.find((b: any) => b.key === 'high')?.doc_count || 0,
      critical: buckets.find((b: any) => b.key === 'critical')?.doc_count || 0,
    };
  }

  /**
   * Convert interval to Elasticsearch format
   */
  private getIntervalValue(interval: string): string {
    const intervalMap: Record<string, string> = {
      minute: '1m',
      hour: '1h',
      day: '1d',
      week: '1w',
      month: '1M',
    };

    return intervalMap[interval] || '1h';
  }

  /**
   * Format term counts from aggregation buckets
   */
  private formatTermCounts(buckets: any[]): Record<string, number> {
    const counts: Record<string, number> = {};

    buckets.forEach((bucket: any) => {
      counts[bucket.key] = bucket.doc_count;
    });

    return counts;
  }
}

export interface EventStatistics {
  totalEvents: number;
  uniqueUsers: number;
  uniqueIPs: number;
  uniqueSources: number;
  averageRiskScore: number;
  maxRiskScore: number;
}

export interface RiskDistribution {
  veryLow: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}
