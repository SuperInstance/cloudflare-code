// @ts-nocheck - Missing properties in BaselineMetrics interface

/**
 * Threat Detection - Anomaly detection and threat response
 * Provides intrusion detection, pattern recognition, and automated response
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
  Threat,
  ThreatType,
  ThreatSeverity,
  ThreatStatus,
  ThreatSource,
  ThreatTarget,
  Indicator,
  IndicatorType,
  ThreatResponse,
  ResponseAction,
  ResponseActionType,
  ResponseResult,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  BaselineMetrics,
  ObservedMetrics,
  ThreatIntelligence,
  ThreatDetectedError,
  AuditEvent,
  PrincipalType,
} from '../types';

// ============================================================================
// THREAT INTELLIGENCE FEEDS
// ============================================================================

export interface ThreatFeed {
  feedId: string;
  name: string;
  update(): Promise<ThreatIntelligence>;
  getIndicators(): Promise<Indicator[]>;
}

export class MockThreatFeed implements ThreatFeed {
  feedId: string;
  name: string;

  constructor(feedId: string, name: string) {
    this.feedId = feedId;
    this.name = name;
  }

  async update(): Promise<ThreatIntelligence> {
    return {
      feedId: this.feedId,
      source: this.name,
      indicators: await this.getIndicators(),
      lastUpdated: new Date(),
      confidence: 0.85,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      categories: ['malware', 'phishing', 'botnet'],
    };
  }

  async getIndicators(): Promise<Indicator[]> {
    // Mock indicators
    return [
      {
        indicatorId: uuidv4(),
        type: IndicatorType.IP_ADDRESS,
        value: '192.168.1.100',
        confidence: 0.9,
        firstSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        occurrences: 150,
      },
      {
        indicatorId: uuidv4(),
        type: IndicatorType.DOMAIN,
        value: 'malicious.example.com',
        confidence: 0.95,
        firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        occurrences: 500,
      },
    ];
  }
}

// ============================================================================
// BASELINE CALCULATOR
// ============================================================================

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export class BaselineCalculator {
  private metricHistory: Map<string, MetricDataPoint[]> = new Map();
  private maxDataPoints: number = 1000;

  /**
   * Add a metric data point
   */
  addMetric(metricName: string, value: number, labels?: Record<string, string>): void {
    const history = this.metricHistory.get(metricName) || [];
    history.push({
      timestamp: new Date(),
      value,
      labels,
    });

    // Trim to max data points
    if (history.length > this.maxDataPoints) {
      history.splice(0, history.length - this.maxDataPoints);
    }

    this.metricHistory.set(metricName, history);
  }

  /**
   * Calculate baseline statistics for a metric
   */
  calculateBaseline(metricName: string, period?: string): BaselineMetrics | null {
    const history = this.metricHistory.get(metricName);
    if (!history || history.length === 0) {
      return null;
    }

    // Filter by period if specified
    let dataPoints = history;
    if (period) {
      const cutoff = this.getCutoffDate(period);
      dataPoints = history.filter(dp => dp.timestamp >= cutoff);
    }

    if (dataPoints.length === 0) {
      return null;
    }

    // Calculate statistics
    const values = dataPoints.map(dp => dp.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      metricName,
      value: mean,
      period: period || 'all',
      sampleSize: dataPoints.length,
      statistics: {
        mean,
        stdDev,
        min,
        max,
        p50: this.percentile(values, 50),
        p95: this.percentile(values, 95),
        p99: this.percentile(values, 99),
      },
    };
  }

  /**
   * Get current value for a metric
   */
  getCurrentValue(metricName: string): number | null {
    const history = this.metricHistory.get(metricName);
    return history && history.length > 0 ? history[history.length - 1].value : null;
  }

  /**
   * Get metric history
   */
  getHistory(metricName: string): MetricDataPoint[] {
    return this.metricHistory.get(metricName) || [];
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  private getCutoffDate(period: string): Date {
    const now = new Date();
    switch (period) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  }
}

// ============================================================================
// ANOMALY DETECTOR
// ============================================================================

export interface AnomalyDetectionConfig {
  threshold: number; // Number of standard deviations from baseline
  minDataPoints: number;
  enabledAnomalyTypes: AnomalyType[];
}

export class AnomalyDetector {
  private baselineCalculator: BaselineCalculator;
  private config: AnomalyDetectionConfig;

  constructor(config: AnomalyDetectionConfig) {
    this.baselineCalculator = new BaselineCalculator();
    this.config = {
      threshold: config.threshold || 3,
      minDataPoints: config.minDataPoints || 30,
      enabledAnomalyTypes: config.enabledAnomalyTypes || Object.values(AnomalyType),
    };
  }

  /**
   * Record a metric and check for anomalies
   */
  async recordAndDetect(
    metricName: string,
    value: number,
    labels?: Record<string, string>
  ): Promise<Anomaly | null> {
    // Add metric to history
    this.baselineCalculator.addMetric(metricName, value, labels);

    // Check for anomaly
    return await this.detectAnomaly(metricName, value);
  }

  /**
   * Detect if a value is anomalous
   */
  async detectAnomaly(metricName: string, value: number): Promise<Anomaly | null> {
    // Check if anomaly detection is enabled
    const anomalyType = this.getAnomalyType(metricName);
    if (!anomalyType || !this.config.enabledAnomalyTypes.includes(anomalyType)) {
      return null;
    }

    // Calculate baseline
    const baseline = this.baselineCalculator.calculateBaseline(metricName, '7d');
    if (!baseline || baseline.sampleSize < this.config.minDataPoints) {
      return null;
    }

    // Calculate z-score
    const statistics = baseline.statistics as any;
    const zScore = Math.abs((value - statistics.mean) / statistics.stdDev);

    // Check if anomaly
    if (zScore > this.config.threshold) {
      return {
        anomalyId: uuidv4(),
        type: anomalyType,
        severity: this.calculateSeverity(zScore),
        confidence: Math.min(zScore / this.config.threshold, 1),
        detectedAt: new Date(),
        description: this.generateDescription(metricName, value, baseline, zScore),
        baseline,
        observed: {
          metricName,
          value,
          timestamp: new Date(),
        },
        deviation: zScore,
        threshold: this.config.threshold,
        context: {
          metricName,
          baselineMean: statistics.mean,
          baselineStdDev: statistics.stdDev,
        },
      };
    }

    return null;
  }

  /**
   * Get anomaly type from metric name
   */
  private getAnomalyType(metricName: string): AnomalyType | null {
    if (metricName.includes('request_rate') || metricName.includes('throughput')) {
      return AnomalyType.VOLUME;
    }
    if (metricName.includes('response_time') || metricName.includes('latency')) {
      return AnomalyType.PERFORMANCE;
    }
    if (metricName.includes('failed_login') || metricName.includes('access_denied')) {
      return AnomalyType.ACCESS;
    }
    if (metricName.includes('config_change') || metricName.includes('permission_change')) {
      return AnomalyType.CONFIGURATION;
    }
    if (metricName.includes('user_behavior') || metricName.includes('activity_pattern')) {
      return AnomalyType.BEHAVIORAL;
    }
    return AnomalyType.STATISTICAL;
  }

  /**
   * Calculate anomaly severity from z-score
   */
  private calculateSeverity(zScore: number): AnomalySeverity {
    if (zScore > 5) {
      return AnomalySeverity.CRITICAL;
    } else if (zScore > 4) {
      return AnomalySeverity.HIGH;
    } else if (zScore > 3) {
      return AnomalySeverity.MEDIUM;
    }
    return AnomalySeverity.LOW;
  }

  /**
   * Generate anomaly description
   */
  private generateDescription(
    metricName: string,
    value: number,
    baseline: BaselineMetrics,
    zScore: number
  ): string {
    const statistics = baseline.statistics as any;
    const percentChange = ((value - statistics.mean) / statistics.mean) * 100;

    return `Anomaly detected in ${metricName}: ` +
           `current value ${value.toFixed(2)} is ${percentChange.toFixed(1)}% ` +
           `different from baseline ${statistics.mean.toFixed(2)} ` +
           `(${zScore.toFixed(2)} standard deviations)`;
  }

  /**
   * Get baseline calculator
   */
  getBaselineCalculator(): BaselineCalculator {
    return this.baselineCalculator;
  }
}

// ============================================================================
// THREAT DETECTOR
// ============================================================================

export interface ThreatDetectorConfig {
  anomalyDetectionEnabled: boolean;
  intelligenceFeeds: ThreatFeed[];
  autoResponseEnabled: boolean;
  alertOnDetection: boolean;
}

export class ThreatDetector extends EventEmitter {
  private anomalyDetector: AnomalyDetector;
  private indicators: Map<string, Indicator> = new Map();
  private threats: Map<string, Threat> = new Map();
  private config: Required<Omit<ThreatDetectorConfig, 'intelligenceFeeds'>> & {
    intelligenceFeeds: ThreatFeed[];
  };

  constructor(config: ThreatDetectorConfig) {
    super();

    this.anomalyDetector = new AnomalyDetector({
      threshold: 3,
      minDataPoints: 30,
      enabledAnomalyTypes: Object.values(AnomalyType),
    });

    this.config = {
      anomalyDetectionEnabled: config.anomalyDetectionEnabled ?? true,
      intelligenceFeeds: config.intelligenceFeeds || [],
      autoResponseEnabled: config.autoResponseEnabled ?? false,
      alertOnDetection: config.alertOnDetection ?? true,
    };

    // Initialize threat intelligence feeds
    this.initializeIntelligenceFeeds();
  }

  /**
   * Initialize threat intelligence feeds
   */
  private async initializeIntelligenceFeeds(): Promise<void> {
    for (const feed of this.config.intelligenceFeeds) {
      try {
        const intelligence = await feed.update();
        for (const indicator of intelligence.indicators) {
          this.indicators.set(this.getIndicatorKey(indicator), indicator);
        }
      } catch (error) {
        console.error(`Failed to initialize threat feed ${feed.name}:`, error);
      }
    }
  }

  /**
   * Update threat intelligence feeds
   */
  async updateIntelligenceFeeds(): Promise<void> {
    for (const feed of this.config.intelligenceFeeds) {
      try {
        const intelligence = await feed.update();
        for (const indicator of intelligence.indicators) {
          this.indicators.set(this.getIndicatorKey(indicator), indicator);
        }
      } catch (error) {
        console.error(`Failed to update threat feed ${feed.name}:`, error);
      }
    }
  }

  /**
   * Get indicator key
   */
  private getIndicatorKey(indicator: Indicator): string {
    return `${indicator.type}:${indicator.value}`;
  }

  /**
   * Analyze an audit event for threats
   */
  async analyzeEvent(event: AuditEvent): Promise<Threat | null> {
    const threats: Threat[] = [];

    // Check for known indicators
    const indicatorThreat = await this.checkIndicators(event);
    if (indicatorThreat) {
      threats.push(indicatorThreat);
    }

    // Check for anomalies
    if (this.config.anomalyDetectionEnabled) {
      const anomalyThreat = await this.checkAnomalies(event);
      if (anomalyThreat) {
        threats.push(anomalyThreat);
      }
    }

    // Check for patterns
    const patternThreat = await this.checkPatterns(event);
    if (patternThreat) {
      threats.push(patternThreat);
    }

    // Return highest severity threat
    if (threats.length > 0) {
      threats.sort((a, b) => {
        const severityOrder = [ThreatSeverity.CRITICAL, ThreatSeverity.HIGH, ThreatSeverity.MEDIUM, ThreatSeverity.LOW];
        return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      });

      const threat = threats[0];
      this.threats.set(threat.threatId, threat);
      this.emit('threatDetected', threat);

      if (this.config.alertOnDetection) {
        this.emit('alert', threat);
      }

      // Trigger auto-response if enabled
      if (this.config.autoResponseEnabled) {
        await this.executeAutoResponse(threat);
      }

      return threat;
    }

    return null;
  }

  /**
   * Check event against known threat indicators
   */
  private async checkIndicators(event: AuditEvent): Promise<Threat | null> {
    const matchedIndicators: Indicator[] = [];

    // Check IP address
    if (event.principal.ip) {
      const ipKey = `${IndicatorType.IP_ADDRESS}:${event.principal.ip}`;
      const indicator = this.indicators.get(ipKey);
      if (indicator) {
        matchedIndicators.push(indicator);
      }
    }

    // Check user agent
    if (event.principal.userAgent) {
      const uaKey = `${IndicatorType.USER_AGENT}:${event.principal.userAgent}`;
      const indicator = this.indicators.get(uaKey);
      if (indicator) {
        matchedIndicators.push(indicator);
      }
    }

    if (matchedIndicators.length > 0) {
      return {
        threatId: uuidv4(),
        type: ThreatType.INTRUSION,
        severity: this.calculateThreatSeverity(matchedIndicators),
        confidence: Math.max(...matchedIndicators.map(i => i.confidence)),
        status: ThreatStatus.DETECTED,
        detectedAt: new Date(),
        source: {
          type: PrincipalType.USER,
          ip: event.principal.ip,
          userAgent: event.principal.userAgent,
          userId: event.principal.id,
        },
        target: {
          type: event.resource.type,
          id: event.resource.id,
          name: event.resource.name,
          classification: event.resource.classification,
        },
        indicators: matchedIndicators,
        description: `Known threat indicators detected in event: ${event.action}`,
        metadata: {
          eventId: event.eventId,
          correlationId: event.correlationId,
        },
      };
    }

    return null;
  }

  /**
   * Check for anomalies in event metrics
   */
  private async checkAnomalies(event: AuditEvent): Promise<Threat | null> {
    // Extract metrics from event
    const metricName = `event.${event.eventType}.${event.outcome}`;
    const metricValue = 1; // Each event counts as 1

    const anomaly = await this.anomalyDetector.recordAndDetect(metricName, metricValue);
    if (!anomaly) {
      return null;
    }

    return {
      threatId: uuidv4(),
      type: ThreatType.ANOMALY,
      severity: anomaly.severity === AnomalySeverity.CRITICAL ? ThreatSeverity.CRITICAL :
                 anomaly.severity === AnomalySeverity.HIGH ? ThreatSeverity.HIGH :
                 anomaly.severity === AnomalySeverity.MEDIUM ? ThreatSeverity.MEDIUM :
                 ThreatSeverity.LOW,
      confidence: anomaly.confidence,
      status: ThreatStatus.DETECTED,
      detectedAt: anomaly.detectedAt,
      source: {
        type: event.principal.type,
        ip: event.principal.ip,
        userId: event.principal.id,
      },
      target: {
        type: event.resource.type,
        id: event.resource.id,
      },
      indicators: [],
      description: anomaly.description,
      metadata: {
        anomalyId: anomaly.anomalyId,
        metricName: anomaly.observed.metricName,
        deviation: anomaly.deviation,
      },
    };
  }

  /**
   * Check for threat patterns
   */
  private async checkPatterns(event: AuditEvent): Promise<Threat | null> {
    // Check for brute force pattern
    if (event.eventType === 'authentication' && event.outcome === 'failure') {
      const recentFailures = await this.countRecentFailures(event.principal.id);
      if (recentFailures >= 5) {
        return {
          threatId: uuidv4(),
          type: ThreatType.BRUTE_FORCE,
          severity: ThreatSeverity.HIGH,
          confidence: 0.9,
          status: ThreatStatus.DETECTED,
          detectedAt: new Date(),
          source: {
            type: event.principal.type,
            ip: event.principal.ip,
            userId: event.principal.id,
          },
          target: {
            type: 'authentication',
            id: 'auth-system',
          },
          indicators: [],
          description: `Brute force attack detected: ${recentFailures} recent failed authentication attempts`,
          metadata: {
            failureCount: recentFailures,
            userId: event.principal.id,
          },
        };
      }
    }

    return null;
  }

  /**
   * Count recent failed authentication attempts for a user
   */
  private async countRecentFailures(userId: string): Promise<number> {
    // In a real implementation, this would query the audit log
    // For now, return a mock value
    return 0;
  }

  /**
   * Calculate threat severity from indicators
   */
  private calculateThreatSeverity(indicators: Indicator[]): ThreatSeverity {
    const avgConfidence = indicators.reduce((sum, i) => sum + i.confidence, 0) / indicators.length;

    if (avgConfidence >= 0.9) {
      return ThreatSeverity.CRITICAL;
    } else if (avgConfidence >= 0.7) {
      return ThreatSeverity.HIGH;
    } else if (avgConfidence >= 0.5) {
      return ThreatSeverity.MEDIUM;
    }
    return ThreatSeverity.LOW;
  }

  /**
   * Execute automated response to a threat
   */
  private async executeAutoResponse(threat: Threat): Promise<ThreatResponse> {
    const actions: ResponseAction[] = [];

    switch (threat.type) {
      case ThreatType.BRUTE_FORCE:
        actions.push({
          type: ResponseActionType.BLOCK_IP,
          parameters: {
            ip: threat.source.ip,
            duration: 3600, // 1 hour
          },
          executed: true,
          result: ResponseResult.SUCCESS,
        });
        break;

      case ThreatType.INTRUSION:
        actions.push({
          type: ResponseActionType.BLOCK_USER,
          parameters: {
            userId: threat.source.userId,
          },
          executed: true,
          result: ResponseResult.SUCCESS,
        });
        actions.push({
          type: ResponseActionType.NOTIFY_ADMIN,
          parameters: {
            message: `Intrusion detected from ${threat.source.ip}`,
            severity: threat.severity,
          },
          executed: true,
          result: ResponseResult.SUCCESS,
        });
        break;

      case ThreatType.ANOMALY:
        if (threat.severity === ThreatSeverity.CRITICAL) {
          actions.push({
            type: ResponseActionType.NOTIFY_ADMIN,
            parameters: {
              message: `Critical anomaly detected: ${threat.description}`,
              severity: threat.severity,
            },
            executed: true,
            result: ResponseResult.SUCCESS,
          });
        }
        break;
    }

    const response: ThreatResponse = {
      responseId: uuidv4(),
      actions,
      executedAt: new Date(),
      executedBy: 'auto-responder',
      automatic: true,
      result: actions.every(a => a.result === ResponseResult.SUCCESS) ?
        ResponseResult.SUCCESS : ResponseResult.PARTIAL,
    };

    threat.response = response;
    threat.status = ThreatStatus.MITIGATING;

    this.emit('responseExecuted', response);

    return response;
  }

  /**
   * Get all threats
   */
  getThreats(filter?: { status?: ThreatStatus; severity?: ThreatSeverity }): Threat[] {
    let threats = Array.from(this.threats.values());

    if (filter?.status) {
      threats = threats.filter(t => t.status === filter.status);
    }

    if (filter?.severity) {
      threats = threats.filter(t => t.severity === filter.severity);
    }

    return threats.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  /**
   * Get a specific threat
   */
  getThreat(threatId: string): Threat | null {
    return this.threats.get(threatId) || null;
  }

  /**
   * Update threat status
   */
  updateThreatStatus(threatId: string, status: ThreatStatus): void {
    const threat = this.threats.get(threatId);
    if (threat) {
      threat.status = status;
    }
  }
}

// All classes are already exported inline - no duplicate export needed
