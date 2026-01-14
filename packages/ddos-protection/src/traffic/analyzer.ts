/**
 * Traffic Analyzer
 * Analyzes incoming traffic patterns to detect anomalies and potential attacks
 */

import type {
  RequestData,
  TrafficAnalysis,
  RequestMetrics,
  PatternAnalysis,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  PathMetric,
  UserAgentMetric,
  StatisticsSnapshot
} from '../types';
import { IPUtils, RequestParser, MathUtils, TimeUtils, StringUtils } from '../utils';

/**
 * Traffic window configuration
 */
interface TrafficWindow {
  start: number;
  end: number;
  requests: RequestData[];
}

/**
 * Analysis result
 */
interface AnalysisResult {
  metrics: RequestMetrics;
  patterns: PatternAnalysis;
  anomalies: Anomaly[];
  riskScore: number;
}

/**
 * Traffic Analyzer class
 */
export class TrafficAnalyzer {
  private trafficWindows: Map<number, TrafficWindow>;
  private currentWindow: TrafficWindow | null;
  private windowSize: number;
  private maxWindows: number;
  private pathMetrics: Map<string, PathMetric>;
  private userAgentMetrics: Map<string, UserAgentMetric>;
  private ipRequestCounts: Map<string, number[]>;
  private statistics: StatisticsSnapshot[] | null;
  private readonly STATS_HISTORY_SIZE = 100;

  constructor(config: { windowSize?: number; maxWindows?: number; trackStatistics?: boolean } = {}) {
    this.windowSize = config.windowSize || 60000; // 1 minute default
    this.maxWindows = config.maxWindows || 60; // Keep 60 minutes of history
    this.trafficWindows = new Map();
    this.currentWindow = null;
    this.pathMetrics = new Map();
    this.userAgentMetrics = new Map();
    this.ipRequestCounts = new Map();
    this.statistics = config.trackStatistics ? [] : null;
  }

  /**
   * Process incoming request
   */
  async processRequest(request: RequestData): Promise<TrafficAnalysis> {
    const now = TimeUtils.now();

    // Initialize current window if needed
    if (!this.currentWindow || now >= this.currentWindow.end) {
      this.rotateWindow(now);
    }

    // Add request to current window
    this.currentWindow!.requests.push(request);

    // Update metrics
    this.updatePathMetrics(request);
    this.updateUserAgentMetrics(request);
    this.updateIPRequestCounts(request);

    // Perform analysis
    const analysis = await this.analyzeTraffic(request);

    // Update statistics if tracking is enabled
    if (this.statistics) {
      this.updateStatistics(request);
    }

    return {
      requestData: request,
      metrics: analysis.metrics,
      patterns: analysis.patterns,
      anomalies: analysis.anomalies,
      riskScore: analysis.riskScore,
      recommendations: this.generateRecommendations(analysis)
    };
  }

  /**
   * Analyze traffic patterns
   */
  private async analyzeTraffic(request: RequestData): Promise<AnalysisResult> {
    const metrics = this.calculateMetrics();
    const patterns = this.analyzePatterns(metrics, request);
    const anomalies = this.detectAnomalies(metrics, patterns);
    const riskScore = this.calculateRiskScore(metrics, patterns, anomalies);

    return {
      metrics,
      patterns,
      anomalies,
      riskScore
    };
  }

  /**
   * Calculate current traffic metrics
   */
  private calculateMetrics(): RequestMetrics {
    const allRequests = this.getAllRequestsInWindow();
    const now = TimeUtils.now();

    // Calculate requests per second
    const windowDuration = Math.min(this.windowSize, now - (this.currentWindow?.start || now));
    const requestsPerSecond = MathUtils.calculateRate(allRequests.length, windowDuration);

    // Calculate error rate
    const errorRequests = allRequests.filter(r => {
      const status = parseInt(r.headers['status'] || '200', 10);
      return status >= 400;
    });
    const errorRate = allRequests.length > 0 ? errorRequests.length / allRequests.length : 0;

    // Count unique IPs
    const uniqueIPs = new Set(allRequests.map(r => r.ip));

    // Get top paths and user agents
    const topPaths = this.getTopPaths(10);
    const topUserAgents = this.getTopUserAgents(10);

    // Calculate status code distribution
    const statusCodes: Record<number, number> = {};
    allRequests.forEach(r => {
      const status = parseInt(r.headers['status'] || '200', 10);
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });

    return {
      totalRequests: allRequests.length,
      requestsPerSecond,
      averageResponseTime: this.calculateAverageResponseTime(allRequests),
      errorRate,
      uniqueIps: uniqueIPs.size,
      topPaths,
      topUserAgents,
      statusCodes
    };
  }

  /**
   * Analyze traffic patterns
   */
  private analyzePatterns(metrics: RequestMetrics, request: RequestData): PatternAnalysis {
    const indicators: string[] = [];
    const patterns: string[] = [];
    let attackType: string | undefined;
    let confidence = 0;
    let behavioralScore = 0.5;

    // High volume indicator
    if (metrics.requestsPerSecond > 1000) {
      indicators.push('high_request_volume');
      confidence += 0.3;
    }

    // High error rate indicator
    if (metrics.errorRate > 0.5) {
      indicators.push('high_error_rate');
      patterns.push('error_storm');
      confidence += 0.2;
    }

    // Concentrated source indicator
    const ipDistribution = this.getIPDistribution();
    const topIPRatio = ipDistribution[0]?.count / metrics.totalRequests;
    if (topIPRatio > 0.5) {
      indicators.push('concentrated_source');
      patterns.push('single_source_attack');
      confidence += 0.2;
    }

    // Path concentration indicator
    if (metrics.topPaths.length > 0) {
      const topPathRatio = metrics.topPaths[0].count / metrics.totalRequests;
      if (topPathRatio > 0.8) {
        indicators.push('path_concentration');
        patterns.push('endpoint_targeted');
        confidence += 0.15;
      }
    }

    // Bot indicator
    const botRatio = metrics.topUserAgents.filter(ua => ua.isBot).reduce((sum, ua) => sum + ua.count, 0) / metrics.totalRequests;
    if (botRatio > 0.7) {
      indicators.push('high_bot_traffic');
      patterns.push('bot_attack');
      confidence += 0.25;
    }

    // Geographic anomaly indicator
    if (this.detectGeographicAnomaly()) {
      indicators.push('geographic_anomaly');
      patterns.push('geo_attack');
      confidence += 0.15;
    }

    // Behavioral analysis
    behavioralScore = this.calculateBehavioralScore(request, metrics);

    // Determine attack type based on patterns
    if (patterns.includes('single_source_attack') && metrics.requestsPerSecond > 500) {
      attackType = 'volumetric';
    } else if (patterns.includes('endpoint_targeted') && metrics.errorRate > 0.5) {
      attackType = 'application';
    } else if (patterns.includes('bot_attack')) {
      attackType = 'bot';
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    return {
      attackType,
      confidence,
      indicators,
      patterns,
      behavioralScore
    };
  }

  /**
   * Detect anomalies in traffic
   */
  private detectAnomalies(metrics: RequestMetrics, patterns: PatternAnalysis): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const now = TimeUtils.now();

    // Check for high volume anomaly
    if (metrics.requestsPerSecond > 1000) {
      anomalies.push({
        type: 'high_volume' as AnomalyType,
        severity: this.getSeverityFromValue(metrics.requestsPerSecond, 1000, 5000, 10000),
        description: `Unusually high request rate: ${metrics.requestsPerSecond.toFixed(2)} req/s`,
        confidence: Math.min(metrics.requestsPerSecond / 10000, 1.0),
        timestamp: now
      });
    }

    // Check for high error rate
    if (metrics.errorRate > 0.5) {
      anomalies.push({
        type: 'high_error_rate' as AnomalyType,
        severity: this.getSeverityFromValue(metrics.errorRate, 0.5, 0.7, 0.9),
        description: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`,
        confidence: metrics.errorRate,
        timestamp: now
      });
    }

    // Check for suspicious user agents
    const suspiciousUA = this.detectSuspiciousUserAgents();
    if (suspiciousUA.length > 0) {
      anomalies.push({
        type: 'suspicious_user_agent' as AnomalyType,
        severity: 'medium' as AnomalySeverity,
        description: `Detected ${suspiciousUA.length} suspicious user agents`,
        confidence: 0.7,
        timestamp: now,
        metadata: { userAgents: suspiciousUA }
      });
    }

    // Check for geographic anomalies
    if (patterns.indicators.includes('geographic_anomaly')) {
      anomalies.push({
        type: 'geographic_anomaly' as AnomalyType,
        severity: 'medium' as AnomalySeverity,
        description: 'Traffic originating from unusual geographic locations',
        confidence: 0.6,
        timestamp: now
      });
    }

    // Check for behavioral anomalies
    if (patterns.behavioralScore < 0.3) {
      anomalies.push({
        type: 'behavioral_anomaly' as AnomalyType,
        severity: 'high' as AnomalySeverity,
        description: `Suspicious behavioral patterns detected (score: ${patterns.behavioralScore.toFixed(2)})`,
        confidence: 1 - patterns.behavioralScore,
        timestamp: now
      });
    }

    // Check for unusual request patterns
    if (this.detectUnusualPatterns()) {
      anomalies.push({
        type: 'unusual_pattern' as AnomalyType,
        severity: 'low' as AnomalySeverity,
        description: 'Unusual request patterns detected',
        confidence: 0.5,
        timestamp: now
      });
    }

    return anomalies;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(
    metrics: RequestMetrics,
    patterns: PatternAnalysis,
    anomalies: Anomaly[]
  ): number {
    let riskScore = 0;

    // Volume risk
    const volumeRisk = Math.min(metrics.requestsPerSecond / 10000, 1.0) * 0.3;
    riskScore += volumeRisk;

    // Error rate risk
    const errorRisk = metrics.errorRate * 0.2;
    riskScore += errorRisk;

    // Pattern risk
    const patternRisk = patterns.confidence * 0.25;
    riskScore += patternRisk;

    // Anomaly risk
    const anomalyRisk = anomalies.reduce((sum, a) => sum + a.confidence, 0) / Math.max(anomalies.length, 1) * 0.15;
    riskScore += anomalyRisk;

    // Behavioral risk
    const behavioralRisk = (1 - patterns.behavioralScore) * 0.1;
    riskScore += behavioralRisk;

    return Math.min(riskScore, 1.0);
  }

  /**
   * Update path metrics
   */
  private updatePathMetrics(request: RequestData): void {
    const path = RequestParser.extractPath(request.url);
    const status = parseInt(request.headers['status'] || '200', 10);

    let metric = this.pathMetrics.get(path);
    if (!metric) {
      metric = {
        path,
        count: 0,
        averageResponseTime: 0,
        errorRate: 0
      };
      this.pathMetrics.set(path, metric);
    }

    metric.count++;
    const responseTime = parseInt(request.headers['x-response-time'] || '0', 10);
    metric.averageResponseTime = (metric.averageResponseTime * (metric.count - 1) + responseTime) / metric.count;

    if (status >= 400) {
      const errorCount = Math.round(metric.errorRate * (metric.count - 1)) + 1;
      metric.errorRate = errorCount / metric.count;
    }
  }

  /**
   * Update user agent metrics
   */
  private updateUserAgentMetrics(request: RequestData): void {
    const parsed = RequestParser.parseUserAgent(request.userAgent);

    let metric = this.userAgentMetrics.get(request.userAgent);
    if (!metric) {
      metric = {
        userAgent: request.userAgent,
        count: 0,
        isBot: parsed.isBot,
        reputation: 0.5
      };
      this.userAgentMetrics.set(request.userAgent, metric);
    }

    metric.count++;
  }

  /**
   * Update IP request counts
   */
  private updateIPRequestCounts(request: RequestData): void {
    const now = TimeUtils.now();
    let timestamps = this.ipRequestCounts.get(request.ip);
    if (!timestamps) {
      timestamps = [];
      this.ipRequestCounts.set(request.ip, timestamps);
    }

    // Clean old timestamps
    const windowStart = now - this.windowSize;
    timestamps.push(now);
    timestamps = timestamps.filter(ts => ts > windowStart);

    this.ipRequestCounts.set(request.ip, timestamps);
  }

  /**
   * Rotate traffic window
   */
  private rotateWindow(now: number): void {
    const newWindow: TrafficWindow = {
      start: now,
      end: now + this.windowSize,
      requests: []
    };

    // Save current window
    if (this.currentWindow) {
      this.trafficWindows.set(this.currentWindow.start, this.currentWindow);

      // Clean old windows
      if (this.trafficWindows.size > this.maxWindows) {
        const oldestKey = Array.from(this.trafficWindows.keys()).sort()[0];
        this.trafficWindows.delete(oldestKey);
      }
    }

    this.currentWindow = newWindow;
  }

  /**
   * Get all requests in current window
   */
  private getAllRequestsInWindow(): RequestData[] {
    const requests: RequestData[] = [];

    if (this.currentWindow) {
      requests.push(...this.currentWindow.requests);
    }

    // Also include recent requests from previous windows
    const now = TimeUtils.now();
    const windowStart = now - this.windowSize;

    for (const window of this.trafficWindows.values()) {
      if (window.end > windowStart) {
        requests.push(...window.requests.filter(r => r.timestamp >= windowStart));
      }
    }

    return requests;
  }

  /**
   * Get top paths by request count
   */
  private getTopPaths(limit: number): PathMetric[] {
    return Array.from(this.pathMetrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top user agents
   */
  private getTopUserAgents(limit: number): UserAgentMetric[] {
    return Array.from(this.userAgentMetrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get IP distribution (top IPs by request count)
   */
  private getIPDistribution(): Array<{ ip: string; count: number }> {
    const distribution: Array<{ ip: string; count: number }> = [];

    for (const [ip, timestamps] of this.ipRequestCounts.entries()) {
      distribution.push({ ip, count: timestamps.length });
    }

    return distribution.sort((a, b) => b.count - a.count);
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(requests: RequestData[]): number {
    if (requests.length === 0) return 0;

    const responseTimes = requests
      .map(r => parseInt(r.headers['x-response-time'] || '0', 10))
      .filter(rt => rt > 0);

    if (responseTimes.length === 0) return 0;

    return responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
  }

  /**
   * Calculate behavioral score for a request
   */
  private calculateBehavioralScore(request: RequestData, metrics: RequestMetrics): number {
    let score = 1.0;

    // Check user agent
    const parsedUA = RequestParser.parseUserAgent(request.userAgent);
    if (parsedUA.isBot) {
      score -= 0.3;
    }

    // Check for suspicious headers
    if (request.headers['x-forwarded-for'] && request.headers['x-forwarded-for'].split(',').length > 5) {
      score -= 0.2;
    }

    // Check request size
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    if (contentLength > 10_000_000) { // 10MB
      score -= 0.1;
    }

    // Check request frequency from this IP
    const ipTimestamps = this.ipRequestCounts.get(request.ip) || [];
    if (ipTimestamps.length > 100) {
      score -= 0.2;
    }

    // Check URL patterns
    if (request.url.includes('../') || request.url.includes('%2e%2e')) {
      score -= 0.3; // Path traversal attempt
    }

    // Check for SQL injection patterns
    const sqlPatterns = ["'", '"', ' OR ', ' AND ', ' UNION ', ' SELECT ', ' DROP '];
    if (sqlPatterns.some(pattern => request.url.toUpperCase().includes(pattern))) {
      score -= 0.4;
    }

    return Math.max(0, score);
  }

  /**
   * Detect geographic anomalies
   */
  private detectGeographicAnomaly(): boolean {
    const requests = this.getAllRequestsInWindow();
    const countries = new Map<string, number>();

    requests.forEach(r => {
      if (r.geo?.country) {
        countries.set(r.geo.country, (countries.get(r.geo.country) || 0) + 1);
      }
    });

    // Check if traffic is concentrated in unusual locations
    const topCountry = Array.from(countries.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topCountry && topCountry[1] / requests.length > 0.9) {
      // 90%+ from single country - check if it's unusual
      const unusualCountries = ['CN', 'RU', 'KP', 'IR'];
      if (unusualCountries.includes(topCountry[0])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect suspicious user agents
   */
  private detectSuspiciousUserAgents(): string[] {
    const suspicious: string[] = [];
    const botPatterns = [
      /bot/i,
      /spider/i,
      /crawl/i,
      /scrape/i,
      /curl/i,
      /wget/i,
      /python/i,
      /go-http-client/i
    ];

    for (const [ua, metric] of this.userAgentMetrics) {
      if (metric.isBot && botPatterns.some(pattern => pattern.test(ua))) {
        suspicious.push(ua);
      }
    }

    return suspicious;
  }

  /**
   * Detect unusual request patterns
   */
  private detectUnusualPatterns(): boolean {
    const requests = this.getAllRequestsInWindow();

    // Check for repetitive requests to same endpoint
    const urlCounts = new Map<string, number>();
    requests.forEach(r => {
      urlCounts.set(r.url, (urlCounts.get(r.url) || 0) + 1);
    });

    const maxCount = Math.max(...urlCounts.values());
    if (maxCount > requests.length * 0.8) {
      return true;
    }

    // Check for sequential IDs in URLs (indicating scraping)
    const numbers = requests
      .map(r => r.url.match(/\d+/g)?.[0])
      .filter(Boolean)
      .map(Number);

    if (numbers.length > 10) {
      const sorted = numbers.slice().sort((a, b) => a - b);
      let sequentialCount = 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] === 1) {
          sequentialCount++;
        }
      }
      if (sequentialCount > numbers.length * 0.5) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get severity from value
   */
  private getSeverityFromValue(
    value: number,
    lowThreshold: number,
    mediumThreshold: number,
    highThreshold: number
  ): AnomalySeverity {
    if (value < lowThreshold) return 'low' as AnomalySeverity;
    if (value < mediumThreshold) return 'medium' as AnomalySeverity;
    if (value < highThreshold) return 'high' as AnomalySeverity;
    return 'critical' as AnomalySeverity;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(analysis: AnalysisResult): string[] {
    const recommendations: string[] = [];

    if (analysis.metrics.requestsPerSecond > 1000) {
      recommendations.push('Implement rate limiting to reduce request volume');
    }

    if (analysis.metrics.errorRate > 0.5) {
      recommendations.push('Investigate high error rate - may indicate application-level attack');
    }

    if (analysis.patterns.indicators.includes('high_bot_traffic')) {
      recommendations.push('Enable bot detection and challenge platform');
    }

    if (analysis.patterns.indicators.includes('concentrated_source')) {
      recommendations.push('Consider blocking top source IPs');
    }

    if (analysis.riskScore > 0.8) {
      recommendations.push('High risk score detected - enable aggressive mitigation');
    }

    if (analysis.anomalies.some(a => a.type === 'behavioral_anomaly')) {
      recommendations.push('Implement behavioral analysis and fingerprinting');
    }

    return recommendations;
  }

  /**
   * Update statistics
   */
  private updateStatistics(request: RequestData): void {
    if (!this.statistics) return;

    const responseTime = parseInt(request.headers['x-response-time'] || '0', 10);
    const status = parseInt(request.headers['status'] || '200', 10);
    const isError = status >= 400;

    const lastStats = this.statistics[this.statistics.length - 1];

    if (!lastStats || TimeUtils.now() - lastStats.timestamp > 1000) {
      // Create new snapshot every second
      this.statistics.push({
        timestamp: TimeUtils.now(),
        requests: 1,
        blocked: 0,
        challenged: 0,
        allowed: isError ? 0 : 1,
        errors: isError ? 1 : 0,
        averageLatency: responseTime,
        p95Latency: responseTime,
        p99Latency: responseTime
      });

      // Keep only recent statistics
      if (this.statistics.length > this.STATS_HISTORY_SIZE) {
        this.statistics.shift();
      }
    } else {
      // Update existing snapshot
      lastStats.requests++;
      lastStats.errors += isError ? 1 : 0;
      lastStats.allowed += isError ? 0 : 1;
      // Update percentiles (simplified)
      lastStats.averageLatency = (lastStats.averageLatency + responseTime) / 2;
    }
  }

  /**
   * Get current statistics
   */
  getStatistics(): StatisticsSnapshot | null {
    if (!this.statistics || this.statistics.length === 0) return null;
    return this.statistics[this.statistics.length - 1];
  }

  /**
   * Get statistics history
   */
  getStatisticsHistory(): StatisticsSnapshot[] {
    return this.statistics || [];
  }

  /**
   * Reset analyzer state
   */
  reset(): void {
    this.trafficWindows.clear();
    this.currentWindow = null;
    this.pathMetrics.clear();
    this.userAgentMetrics.clear();
    this.ipRequestCounts.clear();
    this.statistics = [];
  }

  /**
   * Get analyzer state
   */
  getState(): any {
    return {
      windowSize: this.windowSize,
      maxWindows: this.maxWindows,
      currentWindowStart: this.currentWindow?.start,
      totalWindows: this.trafficWindows.size,
      pathMetricsCount: this.pathMetrics.size,
      userAgentMetricsCount: this.userAgentMetrics.size,
      ipRequestCountsCount: this.ipRequestCounts.size
    };
  }
}
