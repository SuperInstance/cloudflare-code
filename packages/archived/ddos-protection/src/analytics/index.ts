/**
 * Analytics Dashboard
 * Provides comprehensive analytics and reporting for DDoS protection
 */

import type {
  AnalyticsData,
  TimePeriod,
  AttackType,
  RequestMetrics,
  MitigationResult,
  StatisticsSnapshot,
  RealtimeMonitoring
} from '../types';
import { TimeUtils } from '../utils';

/**
 * Analytics data point
 */
interface DataPoint {
  timestamp: number;
  value: number;
  metadata?: Record<string, any>;
}

/**
 * Time series data
 */
interface TimeSeries {
  metric: string;
  period: TimePeriod;
  data: DataPoint[];
}

/**
 * Aggregated statistics
 */
interface AggregatedStats {
  total: number;
  average: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

/**
 * Geographic distribution
 */
interface GeoDistribution {
  country: string;
  requests: number;
  attacks: number;
  riskScore: number;
}

/**
 * Analytics Manager class
 */
export class AnalyticsManager {
  private requestMetrics: Map<number, RequestMetrics>;
  private mitigationHistory: MitigationResult[];
  private statisticsHistory: StatisticsSnapshot[];
  private attackHistory: Array<{
    timestamp: number;
    type: AttackType;
    severity: string;
    sourceIps: string[];
  }>;
  private geoData: Map<string, GeoDistribution>;
  private readonly MAX_HISTORY_SIZE = 10000;

  constructor() {
    this.requestMetrics = new Map();
    this.mitigationHistory = [];
    this.statisticsHistory = [];
    this.attackHistory = [];
    this.geoData = new Map();

    this.startCleanupTimer();
  }

  /**
   * Record request metrics
   */
  recordMetrics(metrics: RequestMetrics): void {
    const timestamp = TimeUtils.getTimeBucket(TimeUtils.now(), 60000); // 1-minute buckets
    this.requestMetrics.set(timestamp, metrics);
  }

  /**
   * Record mitigation action
   */
  recordMitigation(result: MitigationResult): void {
    this.mitigationHistory.push(result);

    // Trim history if needed
    if (this.mitigationHistory.length > this.MAX_HISTORY_SIZE) {
      this.mitigationHistory.shift();
    }
  }

  /**
   * Record statistics snapshot
   */
  recordStatistics(stats: StatisticsSnapshot): void {
    this.statisticsHistory.push(stats);

    // Trim history if needed
    if (this.statisticsHistory.length > this.MAX_HISTORY_SIZE) {
      this.statisticsHistory.shift();
    }
  }

  /**
   * Record attack
   */
  recordAttack(
    type: AttackType,
    severity: string,
    sourceIps: string[]
  ): void {
    this.attackHistory.push({
      timestamp: TimeUtils.now(),
      type,
      severity,
      sourceIps
    });

    // Trim history if needed
    if (this.attackHistory.length > this.MAX_HISTORY_SIZE) {
      this.attackHistory.shift();
    }
  }

  /**
   * Record geographic data
   */
  recordGeoData(country: string, isAttack: boolean): void {
    let data = this.geoData.get(country);

    if (!data) {
      data = {
        country,
        requests: 0,
        attacks: 0,
        riskScore: 0
      };
      this.geoData.set(country, data);
    }

    data.requests++;
    if (isAttack) {
      data.attacks++;
    }

    // Update risk score
    data.riskScore = data.attacks / data.requests;
  }

  /**
   * Get analytics for time period
   */
  getAnalytics(period: TimePeriod): AnalyticsData {
    const now = TimeUtils.now();
    const startTime = this.getPeriodStartTime(now, period);

    // Filter data within period
    const metricsInRange = Array.from(this.requestMetrics.entries())
      .filter(([timestamp]) => timestamp >= startTime)
      .map(([, metrics]) => metrics);

    const attacksInRange = this.attackHistory.filter(
      attack => attack.timestamp >= startTime
    );

    const mitigationsInRange = this.mitigationHistory.filter(
      mitigation => mitigation.timestamp >= startTime
    );

    // Calculate analytics
    const totalRequests = metricsInRange.reduce(
      (sum, m) => sum + m.totalRequests,
      0
    );

    const blockedRequests = mitigationsInRange.reduce(
      (sum, m) => sum + (m.success ? m.metrics.trafficBlocked : 0),
      0
    );

    const attacksDetected = attacksInRange.length;
    const attacksMitigated = mitigationsInRange.filter(m => m.success).length;

    // Top attack types
    const topAttackTypes: Record<AttackType, number> = {} as any;
    for (const attack of attacksInRange) {
      topAttackTypes[attack.type] = (topAttackTypes[attack.type] || 0) + 1;
    }

    // Top source countries
    const topSourceCountries: Record<string, number> = {};
    for (const [country, data] of this.geoData.entries()) {
      topSourceCountries[country] = data.requests;
    }

    // Average response time
    const avgResponseTime = this.calculateAverage(metricsInRange.map(m => m.averageResponseTime));

    // Peak RPS
    const peakRPS = Math.max(...metricsInRange.map(m => m.requestsPerSecond), 0);

    // Risk score
    const riskScore = this.calculateRiskScore(totalRequests, blockedRequests, attacksDetected);

    return {
      period,
      totalRequests,
      blockedRequests,
      attacksDetected,
      attacksMitigated,
      topAttackTypes,
      topSourceCountries,
      averageResponseTime: avgResponseTime,
      peakRequestsPerSecond: peakRPS,
      riskScore
    };
  }

  /**
   * Get time series data
   */
  getTimeSeries(metric: string, period: TimePeriod): TimeSeries {
    const now = TimeUtils.now();
    const startTime = this.getPeriodStartTime(now, period);
    const bucketSize = this.getBucketSize(period);

    const data: DataPoint[] = [];
    let currentBucket = startTime;

    while (currentBucket < now) {
      let value = 0;

      switch (metric) {
        case 'requests':
          value = this.getRequestsInBucket(currentBucket, bucketSize);
          break;
        case 'attacks':
          value = this.getAttacksInBucket(currentBucket, bucketSize);
          break;
        case 'rps':
          value = this.getRPSInBucket(currentBucket, bucketSize);
          break;
        case 'error_rate':
          value = this.getErrorRateInBucket(currentBucket, bucketSize);
          break;
        case 'latency':
          value = this.getLatencyInBucket(currentBucket, bucketSize);
          break;
        default:
          value = 0;
      }

      data.push({
        timestamp: currentBucket,
        value
      });

      currentBucket += bucketSize;
    }

    return {
      metric,
      period,
      data
    };
  }

  /**
   * Get aggregated statistics
   */
  getAggregatedStats(metric: string, period: TimePeriod): AggregatedStats {
    const timeSeries = this.getTimeSeries(metric, period);
    const values = timeSeries.data.map(d => d.value);

    if (values.length === 0) {
      return {
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      total: values.reduce((sum, v) => sum + v, 0),
      average: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    };
  }

  /**
   * Get real-time monitoring data
   */
  getRealtimeMonitoring(): RealtimeMonitoring {
    const now = TimeUtils.now();
    const windowSize = 60000; // 1 minute

    // Get recent statistics
    const recentStats = this.statisticsHistory.filter(
      s => now - s.timestamp < windowSize
    );

    const latestStats = recentStats[recentStats.length - 1];

    // Calculate current RPS
    const currentRps = latestStats
      ? this.calculateRPSFromStats(recentStats, windowSize)
      : 0;

    // Calculate average response time
    const avgResponseTime = latestStats?.averageLatency || 0;

    // Get active connections (simplified)
    const activeConnections = Math.floor(currentRps * 10);

    // Get blocked requests
    const blockedRequests = recentStats.reduce(
      (sum, s) => sum + s.blocked,
      0
    );

    // Get ongoing attacks
    const recentAttacks = this.attackHistory.filter(
      a => now - a.timestamp < 300000 // 5 minutes
    );

    const ongoingAttacks = recentAttacks.map(a => ({
      id: `${a.type}-${a.timestamp}`,
      type: a.type,
      startTime: a.timestamp,
      duration: now - a.timestamp,
      severity: a.severity as any,
      sourceIps: a.sourceIps,
      mitigationActive: true
    }));

    // Calculate system health
    const systemHealth = this.calculateSystemHealth(
      currentRps,
      avgResponseTime,
      blockedRequests
    );

    return {
      currentRps,
      averageResponseTime: avgResponseTime,
      activeConnections,
      blockedRequests,
      ongoingAttacks,
      systemHealth
    };
  }

  /**
   * Get top attackers
   */
  getTopAttackers(limit: number = 10): Array<{
    ip: string;
    attacks: number;
    lastSeen: number;
  }> {
    const ipCounts = new Map<string, number>();

    for (const attack of this.attackHistory) {
      for (const ip of attack.sourceIps) {
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
      }
    }

    return Array.from(ipCounts.entries())
      .map(([ip, attacks]) => ({
        ip,
        attacks,
        lastSeen: this.getIPLastSeen(ip)
      }))
      .sort((a, b) => b.attacks - a.attacks)
      .slice(0, limit);
  }

  /**
   * Get geographic distribution
   */
  getGeographicDistribution(limit: number = 20): GeoDistribution[] {
    return Array.from(this.geoData.values())
      .sort((a, b) => b.requests - a.requests)
      .slice(0, limit);
  }

  /**
   * Get mitigation effectiveness
   */
  getMitigationEffectiveness(): {
    totalMitigations: number;
    successfulMitigations: number;
    averageTimeToMitigate: number;
    falsePositiveRate: number;
    attacksPrevented: number;
  } {
    const totalMitigations = this.mitigationHistory.length;
    const successfulMitigations = this.mitigationHistory.filter(m => m.success).length;

    const avgTimeToMitigate = successfulMitigations > 0
      ? this.mitigationHistory
          .filter(m => m.success)
          .reduce((sum, m) => sum + m.timeToMitigate, 0) / successfulMitigations
      : 0;

    const falsePositiveRate = this.mitigationHistory.length > 0
      ? this.mitigationHistory
          .reduce((sum, m) => sum + m.falsePositiveRate, 0) / this.mitigationHistory.length
      : 0;

    const attacksPrevented = this.mitigationHistory
      .filter(m => m.success)
      .reduce((sum, m) => sum + m.affectedRequests, 0);

    return {
      totalMitigations,
      successfulMitigations,
      averageTimeToMitigate: avgTimeToMitigate,
      falsePositiveRate,
      attacksPrevented
    };
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(period: TimePeriod): {
    analytics: AnalyticsData;
    realtime: RealtimeMonitoring;
    effectiveness: ReturnType<AnalyticsManager['getMitigationEffectiveness']>;
    topAttackers: Array<{ ip: string; attacks: number; lastSeen: number }>;
    geoDistribution: GeoDistribution[];
  } {
    return {
      analytics: this.getAnalytics(period),
      realtime: this.getRealtimeMonitoring(),
      effectiveness: this.getMitigationEffectiveness(),
      topAttackers: this.getTopAttackers(),
      geoDistribution: this.getGeographicDistribution()
    };
  }

  /**
   * Export data as JSON
   */
  exportData(period: TimePeriod): string {
    const data = {
      analytics: this.getAnalytics(period),
      timeSeries: {
        requests: this.getTimeSeries('requests', period),
        attacks: this.getTimeSeries('attacks', period),
        rps: this.getTimeSeries('rps', period),
        errorRate: this.getTimeSeries('error_rate', period),
        latency: this.getTimeSeries('latency', period)
      },
      aggregatedStats: {
        requests: this.getAggregatedStats('requests', period),
        attacks: this.getAggregatedStats('attacks', period),
        rps: this.getAggregatedStats('rps', period),
        latency: this.getAggregatedStats('latency', period)
      },
      mitigation: this.getMitigationEffectiveness(),
      topAttackers: this.getTopAttackers(),
      geoDistribution: this.getGeographicDistribution(),
      exportedAt: new Date().toISOString()
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Get period start time
   */
  private getPeriodStartTime(now: number, period: TimePeriod): number {
    switch (period) {
      case 'hour':
        return now - 3600000;
      case 'day':
        return now - 86400000;
      case 'week':
        return now - 604800000;
      case 'month':
        return now - 2592000000;
      case 'year':
        return now - 31536000000;
      default:
        return now - 3600000;
    }
  }

  /**
   * Get bucket size for period
   */
  private getBucketSize(period: TimePeriod): number {
    switch (period) {
      case 'hour':
        return 60000; // 1 minute
      case 'day':
        return 300000; // 5 minutes
      case 'week':
        return 3600000; // 1 hour
      case 'month':
        return 86400000; // 1 day
      case 'year':
        return 604800000; // 1 week
      default:
        return 60000;
    }
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Calculate RPS from statistics
   */
  private calculateRPSFromStats(stats: StatisticsSnapshot[], windowMs: number): number {
    if (stats.length === 0) return 0;
    const totalRequests = stats.reduce((sum, s) => sum + s.requests, 0);
    return (totalRequests / windowMs) * 1000;
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(
    totalRequests: number,
    blockedRequests: number,
    attacksDetected: number
  ): number {
    if (totalRequests === 0) return 0;

    const blockedRatio = blockedRequests / totalRequests;
    const attackFactor = Math.min(attacksDetected / 10, 1.0);

    return (blockedRatio * 0.7) + (attackFactor * 0.3);
  }

  /**
   * Calculate system health
   */
  private calculateSystemHealth(
    rps: number,
    avgLatency: number,
    blockedRequests: number
  ): RealtimeMonitoring['systemHealth'] {
    let status: 'healthy' | 'degraded' | 'under_attack' | 'down' = 'healthy';

    if (rps > 10000 || avgLatency > 5000) {
      status = 'under_attack';
    } else if (rps > 5000 || avgLatency > 2000) {
      status = 'degraded';
    }

    // Simulate resource usage
    const cpu = Math.min((rps / 10000) * 100, 100);
    const memory = Math.min((rps / 15000) * 100, 100);
    const disk = Math.random() * 30 + 20; // 20-50%
    const network = Math.min((rps / 8000) * 100, 100);

    return {
      status,
      cpu,
      memory,
      disk,
      network
    };
  }

  /**
   * Get requests in time bucket
   */
  private getRequestsInBucket(start: number, size: number): number {
    const metrics = this.requestMetrics.get(start);
    return metrics?.totalRequests || 0;
  }

  /**
   * Get attacks in time bucket
   */
  private getAttacksInBucket(start: number, size: number): number {
    return this.attackHistory.filter(
      a => a.timestamp >= start && a.timestamp < start + size
    ).length;
  }

  /**
   * Get RPS in time bucket
   */
  private getRPSInBucket(start: number, size: number): number {
    const metrics = this.requestMetrics.get(start);
    return metrics?.requestsPerSecond || 0;
  }

  /**
   * Get error rate in time bucket
   */
  private getErrorRateInBucket(start: number, size: number): number {
    const metrics = this.requestMetrics.get(start);
    return metrics?.errorRate || 0;
  }

  /**
   * Get latency in time bucket
   */
  private getLatencyInBucket(start: number, size: number): number {
    const metrics = this.requestMetrics.get(start);
    return metrics?.averageResponseTime || 0;
  }

  /**
   * Get IP last seen timestamp
   */
  private getIPLastSeen(ip: string): number {
    for (let i = this.attackHistory.length - 1; i >= 0; i--) {
      if (this.attackHistory[i].sourceIps.includes(ip)) {
        return this.attackHistory[i].timestamp;
      }
    }
    return 0;
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanup();
    }, 3600000); // Run every hour
  }

  /**
   * Cleanup old data
   */
  private cleanup(): void {
    const now = TimeUtils.now();
    const maxAge = 7 * 24 * 3600000; // 7 days

    // Clean old metrics
    for (const [timestamp] of this.requestMetrics.entries()) {
      if (now - timestamp > maxAge) {
        this.requestMetrics.delete(timestamp);
      }
    }

    // Trim histories
    while (this.mitigationHistory.length > this.MAX_HISTORY_SIZE) {
      this.mitigationHistory.shift();
    }

    while (this.statisticsHistory.length > this.MAX_HISTORY_SIZE) {
      this.statisticsHistory.shift();
    }

    while (this.attackHistory.length > this.MAX_HISTORY_SIZE) {
      this.attackHistory.shift();
    }
  }

  /**
   * Reset all analytics data
   */
  reset(): void {
    this.requestMetrics.clear();
    this.mitigationHistory = [];
    this.statisticsHistory = [];
    this.attackHistory = [];
    this.geoData.clear();
  }
}
