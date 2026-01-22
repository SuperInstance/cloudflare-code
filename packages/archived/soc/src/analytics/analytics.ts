/**
 * Security Analytics and Metrics
 * Comprehensive security metrics, trends, and reporting
 */

import {
  SecurityMetrics,
  SecurityTrend,
  BehaviorProfile,
  ThreatIntelligence,
  ThreatLevel,
  ThreatType,
  IncidentStatus,
  VulnerabilityStatus,
  VulnerabilityCategory,
  ComplianceFramework
} from '../types';
import { generateId } from '../utils/helpers';

// ============================================================================
// Metrics Calculator
// ============================================================================

export interface MetricsData {
  detections: Array<{
    threatType: ThreatType;
    severity: ThreatLevel;
    timestamp: number;
    confidence: number;
    blocked: boolean;
  }>;
  incidents: Array<{
    id: string;
    type: ThreatType;
    severity: ThreatLevel;
    status: IncidentStatus;
    createdAt: number;
    detectedAt: number;
    containedAt?: number;
    resolvedAt?: number;
  }>;
  vulnerabilities: Array<{
    id: string;
    severity: ThreatLevel;
    category: VulnerabilityCategory;
    status: VulnerabilityStatus;
    discoveredAt: number;
    resolvedAt?: number;
  }>;
  responseActions: Array<{
    action: string;
    success: boolean;
    timestamp: number;
    automated: boolean;
  }>;
  compliance: Array<{
    framework: ComplianceFramework;
    compliantControls: number;
    totalControls: number;
  }>;
}

export class MetricsCalculator {
  /**
   * Calculate comprehensive security metrics
   */
  calculateMetrics(data: MetricsData, period: { start: number; end: number }): SecurityMetrics {
    return {
      period,
      detection: this.calculateDetectionMetrics(data.detections, period),
      incidents: this.calculateIncidentMetrics(data.incidents, period),
      vulnerabilities: this.calculateVulnerabilityMetrics(data.vulnerabilities, period),
      response: this.calculateResponseMetrics(data.responseActions, period),
      compliance: this.calculateComplianceMetrics(data.compliance)
    };
  }

  /**
   * Calculate detection metrics
   */
  private calculateDetectionMetrics(detections: MetricsData['detections'], period: { start: number; end: number }) {
    const periodDetections = detections.filter(d => d.timestamp >= period.start && d.timestamp <= period.end);

    const bySeverity: Record<ThreatLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    const byType: Record<string, number> = {};

    let blockedCount = 0;
    let totalConfidence = 0;

    for (const detection of periodDetections) {
      bySeverity[detection.severity]++;
      byType[detection.threatType] = (byType[detection.threatType] || 0) + 1;
      if (detection.blocked) blockedCount++;
      totalConfidence += detection.confidence;
    }

    const detectionRate = periodDetections.length > 0 ? blockedCount / periodDetections.length : 0;

    // Calculate mean time to detect (would need incident data)
    const meanTimeToDetect = this.calculateMeanTime(
      periodDetections.map(d => d.timestamp),
      period.start
    );

    return {
      totalThreats: periodDetections.length,
      blockedThreats: blockedCount,
      bySeverity,
      byType: byType as Record<ThreatType, number>,
      detectionRate,
      falsePositiveRate: 0, // Would need feedback data
      meanTimeToDetect
    };
  }

  /**
   * Calculate incident metrics
   */
  private calculateIncidentMetrics(incidents: MetricsData['incidents'], period: { start: number; end: number }) {
    const periodIncidents = incidents.filter(i => i.createdAt >= period.start && i.createdAt <= period.end);

    const bySeverity: Record<ThreatLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    let totalContainTime = 0;
    let totalResolveTime = 0;
    let containedCount = 0;
    let resolvedCount = 0;

    for (const incident of periodIncidents) {
      bySeverity[incident.severity]++;

      if (incident.containedAt) {
        totalContainTime += incident.containedAt - incident.detectedAt;
        containedCount++;
      }

      if (incident.resolvedAt) {
        totalResolveTime += incident.resolvedAt - incident.detectedAt;
        resolvedCount++;
      }
    }

    return {
      total: periodIncidents.length,
      open: periodIncidents.filter(i => i.status === 'open' || i.status === 'investigating').length,
      resolved: resolvedCount,
      meanTimeToResolve: resolvedCount > 0 ? totalResolveTime / resolvedCount : 0,
      meanTimeToContain: containedCount > 0 ? totalContainTime / containedCount : 0,
      bySeverity
    };
  }

  /**
   * Calculate vulnerability metrics
   */
  private calculateVulnerabilityMetrics(vulnerabilities: MetricsData['vulnerabilities'], period: { start: number; end: number }) {
    const periodVulns = vulnerabilities.filter(v => v.discoveredAt >= period.start && v.discoveredAt <= period.end);

    const bySeverity: Record<ThreatLevel, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    const byCategory: Record<VulnerabilityCategory, number> = {} as any;

    let totalPatchTime = 0;
    let patchedCount = 0;

    for (const vuln of periodVulns) {
      bySeverity[vuln.severity]++;
      byCategory[vuln.category] = (byCategory[vuln.category] || 0) + 1;

      if (vuln.resolvedAt) {
        totalPatchTime += vuln.resolvedAt - vuln.discoveredAt;
        patchedCount++;
      }
    }

    const openVulns = vulnerabilities.filter(v => v.status === VulnerabilityStatus.OPEN).length;

    return {
      total: periodVulns.length,
      open: openVulns,
      resolved: patchedCount,
      meanTimeToPatch: patchedCount > 0 ? totalPatchTime / patchedCount : 0,
      bySeverity,
      byCategory
    };
  }

  /**
   * Calculate response metrics
   */
  private calculateResponseMetrics(actions: MetricsData['responseActions'], period: { start: number; end: number }) {
    const periodActions = actions.filter(a => a.timestamp >= period.start && a.timestamp <= period.end);

    const automatedCount = periodActions.filter(a => a.automated).length;
    const successCount = periodActions.filter(a => a.success).length;

    return {
      automatedActions: automatedCount,
      manualActions: periodActions.length - automatedCount,
      successRate: periodActions.length > 0 ? successCount / periodActions.length : 0,
      avgResponseTime: 0 // Would need timing data
    };
  }

  /**
   * Calculate compliance metrics
   */
  private calculateComplianceMetrics(compliance: MetricsData['compliance']) {
    if (compliance.length === 0) {
      return {
        framework: 'N/A',
        complianceScore: 0,
        passedControls: 0,
        failedControls: 0,
        pendingControls: 0
      };
    }

    const framework = compliance[0].framework;
    const totalControls = compliance.reduce((sum, c) => sum + c.totalControls, 0);
    const compliantControls = compliance.reduce((sum, c) => sum + c.compliantControls, 0);

    return {
      framework,
      complianceScore: totalControls > 0 ? (compliantControls / totalControls) * 100 : 0,
      passedControls: compliantControls,
      failedControls: totalControls - compliantControls,
      pendingControls: 0
    };
  }

  /**
   * Calculate mean time from timestamps
   */
  private calculateMeanTime(timestamps: number[], periodStart: number): number {
    if (timestamps.length === 0) return 0;

    const diffs = timestamps.map(t => t - periodStart);
    return diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
  }
}

// ============================================================================
// Trend Analyzer
// ============================================================================

export class TrendAnalyzer {
  /**
   * Analyze trend for a metric
   */
  analyzeTrend(data: Array<{ timestamp: number; value: number }>, forecastPoints: number = 10): SecurityTrend {
    if (data.length < 2) {
      return {
        metric: 'unknown',
        data,
        trend: 'stable',
        changePercent: 0
      };
    }

    // Calculate linear regression for trend
    const n = data.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = data[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Determine trend direction
    let trend: 'up' | 'down' | 'stable';
    const threshold = 0.01; // Minimum slope to consider it a trend

    if (Math.abs(slope) < threshold) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'up';
    } else {
      trend = 'down';
    }

    // Calculate change percent
    const firstValue = data[0].value;
    const lastValue = data[data.length - 1].value;
    const changePercent = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    // Generate predictions
    const prediction: Array<{ timestamp: number; value: number; confidence: number }> = [];
    const lastTimestamp = data[data.length - 1].timestamp;
    const avgInterval = data.length > 1
      ? (lastTimestamp - data[0].timestamp) / (data.length - 1)
      : 3600000; // Default 1 hour

    for (let i = 1; i <= forecastPoints; i++) {
      const x = n + i - 1;
      const predictedValue = slope * x + intercept;
      const timestamp = lastTimestamp + (i * avgInterval);

      // Calculate confidence (decreases with distance)
      const confidence = Math.max(0, 1 - (i / forecastPoints) * 0.5);

      prediction.push({
        timestamp,
        value: Math.max(0, predictedValue),
        confidence
      });
    }

    return {
      metric: 'security_metric',
      data,
      trend,
      changePercent,
      prediction
    };
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(data: Array<{ timestamp: number; value: number }>, window: number): Array<{ timestamp: number; value: number; movingAverage: number }> {
    const result: Array<{ timestamp: number; value: number; movingAverage: number }> = [];

    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const windowData = data.slice(start, i + 1);
      const sum = windowData.reduce((s, d) => s + d.value, 0);
      const avg = sum / windowData.length;

      result.push({
        timestamp: data[i].timestamp,
        value: data[i].value,
        movingAverage: avg
      });
    }

    return result;
  }

  /**
   * Detect anomalies in time series data
   */
  detectAnomalies(data: Array<{ timestamp: number; value: number }>, threshold: number = 3): Array<{
    timestamp: number;
    value: number;
    expected: number;
    deviation: number;
    isAnomaly: boolean;
  }> {
    if (data.length < 10) {
      return data.map(d => ({
        timestamp: d.timestamp,
        value: d.value,
        expected: d.value,
        deviation: 0,
        isAnomaly: false
      }));
    }

    // Calculate mean and standard deviation
    const values = data.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return data.map(d => {
      const deviation = Math.abs((d.value - mean) / stdDev);
      const isAnomaly = deviation > threshold;

      return {
        timestamp: d.timestamp,
        value: d.value,
        expected: mean,
        deviation,
        isAnomaly
      };
    });
  }
}

// ============================================================================
// Behavior Profiler
// ============================================================================

export class BehaviorProfiler {
  private profiles: Map<string, BehaviorProfile> = new Map();
  private eventHistory: Map<string, Array<{ timestamp: number; type: string; data: any }>> = new Map();

  /**
   * Record event for behavior profiling
   */
  recordEvent(entityId: string, eventType: string, data: any): void {
    if (!this.eventHistory.has(entityId)) {
      this.eventHistory.set(entityId, []);
    }

    const history = this.eventHistory.get(entityId)!;
    history.push({
      timestamp: Date.now(),
      type: eventType,
      data
    });

    // Keep last 1000 events
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    // Update profile
    this.updateProfile(entityId);
  }

  /**
   * Update behavior profile
   */
  private updateProfile(entityId: string): void {
    const history = this.eventHistory.get(entityId);
    if (!history || history.length === 0) {
      return;
    }

    const recentEvents = history.slice(-100); // Last 100 events

    const profile: BehaviorProfile = {
      id: generateId(),
      entity: {
        type: 'user',
        id: entityId,
        name: entityId
      },
      baseline: this.calculateBaseline(recentEvents),
      anomalies: this.countAnomalies(recentEvents),
      riskScore: this.calculateRiskScore(recentEvents),
      lastUpdated: Date.now()
    };

    this.profiles.set(entityId, profile);
  }

  /**
   * Calculate baseline metrics
   */
  private calculateBaseline(events: Array<{ timestamp: number; type: string; data: any }>) {
    const loginTimes: number[] = [];
    const loginLocations = new Set<string>();
    const accessedResources = new Set<string>();
    const dataTransfers: number[] = [];
    const sessionDurations: number[] = [];

    for (const event of events) {
      if (event.type === 'login') {
        loginTimes.push(event.timestamp);
        if (event.data?.location) {
          loginLocations.add(event.data.location);
        }
      }

      if (event.type === 'access') {
        if (event.data?.resource) {
          accessedResources.add(event.data.resource);
        }
      }

      if (event.type === 'data_transfer') {
        if (event.data?.size) {
          dataTransfers.push(event.data.size);
        }
      }

      if (event.type === 'session_end') {
        if (event.data?.duration) {
          sessionDurations.push(event.data.duration);
        }
      }
    }

    const avgDataTransfer = dataTransfers.length > 0
      ? dataTransfers.reduce((sum, size) => sum + size, 0) / dataTransfers.length
      : 0;

    const maxDataTransfer = dataTransfers.length > 0 ? Math.max(...dataTransfers) : 0;

    const avgSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;

    const maxSessionDuration = sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0;

    return {
      loginTimes,
      loginLocations: Array.from(loginLocations),
      accessedResources: Array.from(accessedResources),
      dataTransfer: {
        avg: avgDataTransfer,
        max: maxDataTransfer
      },
      sessionDuration: {
        avg: avgSessionDuration,
        max: maxSessionDuration
      }
    };
  }

  /**
   * Count anomalies in recent events
   */
  private countAnomalies(events: Array<{ timestamp: number; type: string; data: any }>): number {
    let anomalyCount = 0;

    // Check for unusual patterns
    const eventTypes = new Map<string, number>();
    for (const event of events) {
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);
    }

    // Flag unusual event frequencies
    for (const [type, count] of eventTypes.entries()) {
      if (count > 100) { // More than 100 of same event type
        anomalyCount++;
      }
    }

    return anomalyCount;
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(events: Array<{ timestamp: number; type: string; data: any }>): number {
    let score = 0;

    // High frequency of failed logins
    const failedLogins = events.filter(e => e.type === 'login_failed').length;
    if (failedLogins > 5) {
      score += 30;
    }

    // Unusual access patterns
    const uniqueResources = new Set();
    for (const event of events) {
      if (event.type === 'access' && event.data?.resource) {
        uniqueResources.add(event.data.resource);
      }
    }
    if (uniqueResources.size > 50) {
      score += 20;
    }

    // Large data transfers
    const largeTransfers = events.filter(e =>
      e.type === 'data_transfer' && e.data?.size > 1024 * 1024 * 1024 // > 1GB
    ).length;
    if (largeTransfers > 0) {
      score += 25;
    }

    return Math.min(score, 100);
  }

  /**
   * Get behavior profile
   */
  getProfile(entityId: string): BehaviorProfile | undefined {
    return this.profiles.get(entityId);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): BehaviorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get high-risk entities
   */
  getHighRiskEntities(threshold: number = 70): BehaviorProfile[] {
    return this.getAllProfiles().filter(p => p.riskScore >= threshold);
  }
}

// ============================================================================
// Threat Intelligence Manager
// ============================================================================

export class ThreatIntelligenceManager {
  private intelligence: ThreatIntelligence = {
    indicators: [],
    campaigns: [],
    actors: [],
    exploitKits: [],
    lastUpdated: Date.now(),
    sources: []
  };

  /**
   * Add threat indicator
   */
  addIndicator(indicator: {
    type: 'ip' | 'domain' | 'url' | 'hash' | 'email';
    value: string;
    severity: ThreatLevel;
    description: string;
    tags?: string[];
  }): void {
    this.intelligence.indicators.push({
      id: generateId(),
      type: indicator.type,
      value: indicator.value,
      severity: indicator.severity,
      confidence: 0.8,
      source: 'manual',
      description: indicator.description,
      tags: indicator.tags || [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      sightings: 1,
      isActive: true
    });

    this.intelligence.lastUpdated = Date.now();
  }

  /**
   * Check if indicator is known threat
   */
  checkIndicator(type: string, value: string): {
    isThreat: boolean;
    indicator?: any;
    severity?: ThreatLevel;
  } {
    const indicator = this.intelligence.indicators.find(
      i => i.type === type && i.value === value && i.isActive
    );

    if (indicator) {
      return {
        isThreat: true,
        indicator,
        severity: indicator.severity
      };
    }

    return { isThreat: false };
  }

  /**
   * Add threat campaign
   */
  addCampaign(campaign: {
    name: string;
    description: string;
    targetIndustries: string[];
    targetGeographies: string[];
    tactics: string[];
    techniques: string[];
  }): void {
    this.intelligence.campaigns.push({
      id: generateId(),
      name: campaign.name,
      description: campaign.description,
      targetIndustries: campaign.targetIndustries,
      targetGeographies: campaign.targetGeographies,
      start_date: Date.now(),
      isActive: true,
      tactics: campaign.tactics,
      techniques: campaign.techniques,
      indicators: [],
      confidence: 0.7
    });

    this.intelligence.lastUpdated = Date.now();
  }

  /**
   * Add threat actor
   */
  addActor(actor: {
    name: string;
    aliases: string[];
    description: string;
    origin: string;
    motivations: string[];
    capabilities: string[];
    targets: string[];
  }): void {
    this.intelligence.actors.push({
      id: generateId(),
      name: actor.name,
      aliases: actor.aliases,
      description: actor.description,
      origin: actor.origin,
      motivations: actor.motivations,
      capabilities: actor.capabilities,
      targets: actor.targets,
      knownCampaigns: [],
      lastSeen: Date.now()
    });

    this.intelligence.lastUpdated = Date.now();
  }

  /**
   * Get threat intelligence
   */
  getIntelligence(): ThreatIntelligence {
    return this.intelligence;
  }

  /**
   * Get active campaigns
   */
  getActiveCampaigns(): any[] {
    return this.intelligence.campaigns.filter(c => c.isActive);
  }

  /**
   * Get indicators by severity
   */
  getIndicatorsBySeverity(severity: ThreatLevel): any[] {
    return this.intelligence.indicators.filter(i => i.severity === severity && i.isActive);
  }

  /**
   * Deactivate indicator
   */
  deactivateIndicator(indicatorId: string): boolean {
    const indicator = this.intelligence.indicators.find(i => i.id === indicatorId);
    if (indicator) {
      indicator.isActive = false;
      this.intelligence.lastUpdated = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Update indicator sightings
   */
  updateSightings(indicatorId: string): boolean {
    const indicator = this.intelligence.indicators.find(i => i.id === indicatorId);
    if (indicator) {
      indicator.sightings++;
      indicator.lastSeen = Date.now();
      this.intelligence.lastUpdated = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Import threat intelligence from external source
   */
  async importFromSource(source: string, format: 'json' | 'csv' | 'stix'): Promise<void> {
    // Placeholder for external import
    // In production, this would fetch from threat intel feeds
    this.intelligence.sources.push(source);
    this.intelligence.lastUpdated = Date.now();
  }

  /**
   * Export threat intelligence
   */
  exportIntelligence(format: 'json' | 'csv'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.intelligence, null, 2);
      case 'csv':
        // Convert to CSV format
        const headers = 'id,type,value,severity,description,isActive\n';
        const rows = this.intelligence.indicators.map(i =>
          `${i.id},${i.type},${i.value},${i.severity},"${i.description}",${i.isActive}`
        ).join('\n');
        return headers + rows;
      default:
        return JSON.stringify(this.intelligence);
    }
  }
}

// ============================================================================
// Security Dashboard
// ============================================================================

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'list';
  title: string;
  data: any;
  refreshInterval: number;
}

export class SecurityDashboard {
  private widgets: Map<string, DashboardWidget> = new Map();

  /**
   * Create threat overview widget
   */
  createThreatOverviewWidget(metrics: SecurityMetrics): DashboardWidget {
    return {
      id: generateId(),
      type: 'metric',
      title: 'Threat Overview',
      data: {
        totalThreats: metrics.detection.totalThreats,
        blockedThreats: metrics.detection.blockedThreats,
        blockedPercentage: metrics.detection.totalThreats > 0
          ? (metrics.detection.blockedThreats / metrics.detection.totalThreats * 100).toFixed(1)
          : '0',
        bySeverity: metrics.detection.bySeverity
      },
      refreshInterval: 60000 // 1 minute
    };
  }

  /**
   * Create incident status widget
   */
  createIncidentStatusWidget(metrics: SecurityMetrics): DashboardWidget {
    return {
      id: generateId(),
      type: 'metric',
      title: 'Incident Status',
      data: {
        total: metrics.incidents.total,
        open: metrics.incidents.open,
        resolved: metrics.incidents.resolved,
        meanTimeToResolve: this.formatDuration(metrics.incidents.meanTimeToResolve),
        meanTimeToContain: this.formatDuration(metrics.incidents.meanTimeToContain)
      },
      refreshInterval: 60000
    };
  }

  /**
   * Create vulnerability summary widget
   */
  createVulnerabilitySummaryWidget(metrics: SecurityMetrics): DashboardWidget {
    return {
      id: generateId(),
      type: 'chart',
      title: 'Vulnerability Summary',
      data: {
        total: metrics.vulnerabilities.total,
        open: metrics.vulnerabilities.open,
        bySeverity: metrics.vulnerabilities.bySeverity,
        byCategory: metrics.vulnerabilities.byCategory,
        meanTimeToPatch: this.formatDuration(metrics.vulnerabilities.meanTimeToPatch)
      },
      refreshInterval: 300000 // 5 minutes
    };
  }

  /**
   * Create trend chart widget
   */
  createTrendChartWidget(trend: SecurityTrend): DashboardWidget {
    return {
      id: generateId(),
      type: 'chart',
      title: `Security Trend (${trend.trend})`,
      data: {
        trend: trend.trend,
        changePercent: trend.changePercent.toFixed(2),
        data: trend.data,
        prediction: trend.prediction
      },
      refreshInterval: 300000
    };
  }

  /**
   * Create high-risk entities widget
   */
  createHighRiskEntitiesWidget(profiles: BehaviorProfile[]): DashboardWidget {
    const highRiskProfiles = profiles
      .filter(p => p.riskScore >= 70)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    return {
      id: generateId(),
      type: 'table',
      title: 'High-Risk Entities',
      data: {
        headers: ['Entity', 'Risk Score', 'Anomalies', 'Last Updated'],
        rows: highRiskProfiles.map(p => [
          p.entity.name,
          p.riskScore.toString(),
          p.anomalies.toString(),
          new Date(p.lastUpdated).toLocaleString()
        ])
      },
      refreshInterval: 120000 // 2 minutes
    };
  }

  /**
   * Format duration in milliseconds to human readable
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Add widget to dashboard
   */
  addWidget(widget: DashboardWidget): void {
    this.widgets.set(widget.id, widget);
  }

  /**
   * Remove widget from dashboard
   */
  removeWidget(id: string): boolean {
    return this.widgets.delete(id);
  }

  /**
   * Get all widgets
   */
  getWidgets(): DashboardWidget[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Get dashboard data
   */
  getDashboardData(): {
    widgets: DashboardWidget[];
    lastUpdated: number;
  } {
    return {
      widgets: this.getWidgets(),
      lastUpdated: Date.now()
    };
  }
}
