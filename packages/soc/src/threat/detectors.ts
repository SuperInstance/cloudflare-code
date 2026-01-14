/**
 * Threat Detection Engine
 * Signature-based, anomaly-based, and behavioral threat detection
 */

import {
  ThreatType,
  ThreatDetection,
  ThreatSignature,
  ThreatIndicator,
  ThreatLevel,
  DetectionMethod,
  AnomalyBaseline,
  AnomalyDetection
} from '../types';
import { generateId } from '../utils/helpers';

// ============================================================================
// Signature-Based Detection
// ============================================================================

export class SignatureDetector {
  private signatures: Map<string, ThreatSignature>;
  private customPatterns: Map<ThreatType, RegExp[]>;

  constructor() {
    this.signatures = new Map();
    this.customPatterns = new Map();
    this.initializeDefaultSignatures();
  }

  private initializeDefaultSignatures(): void {
    // SQL Injection patterns
    const sqlInjectionPatterns: RegExp[] = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|;|\/\*|\*\/)/,
      /(\b(EXEC|EXECUTE)\b\s*\(|\b(SP_|XP_)\w+)/i,
      /('|(\\x27)|(\\')|(''))/,
      /(\b(UNION|SELECT)\s+ALL\s+SELECT)/i,
      /(\b(CAST|CONVERT)\s*\()/i,
      /(\b(DECLARE|CURSOR|FETCH)\b)/i,
      /(\b(WAITFOR|DELAY)\s+DELAY\b)/i,
      /(\b(BENCHMARK|SLEEP)\s*\()/i
    ];

    // XSS patterns
    const xssPatterns: RegExp[] = [
      /<script\b[^>]*>[\s\S]*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<style\b[^>]*>[\s\S]*?<\/style>/gi,
      /expression\s*\(/gi,
      /@import/i,
      /<meta\b[^>]*http-equiv[^>]*refresh/i
    ];

    // Command injection patterns
    const commandInjectionPatterns: RegExp[] = [
      /[;&|`$()]/,
      /\|\|/,
      /&&/,
      /`.*`/,
      /\$\([^)]*\)/,
      /;\s*(cat|ls|pwd|whoami|id|rm|cp|mv|nc|netcat|curl|wget)\b/i
    ];

    // Path traversal patterns
    const pathTraversalPatterns: RegExp[] = [
      /\.\.[\/\\]/,
      /%2e%2e[\/\\]/i,
      /%252e%252e[\/\\]/i,
      /\.\.[%252f|%255c]/i,
      /%2e%2e/i,
      /%c0%ae%c0%ae/i
    ];

    // CSRF indicators
    const csrfPatterns: RegExp[] = [
      /<form[^>]*method\s*=\s*["']post["'][^>]*>/i,
      /<input[^>]*type\s*=\s*["']hidden["'][^>]*>/i,
      /<input[^>]*name\s*=\s*["']token["']/i
    ];

    // Data exfiltration patterns
    const exfiltrationPatterns: RegExp[] = [
      /(\b(SELECT|COPY|BULK\s*INSERT|OUTFILE)\s+.*\s+(INTO|FROM)\s+)/i,
      /(base64|hex|encode|encrypt).*\b(dump|export|save|write)\b/i,
      /\b(torrent|ftp|sftp|ssh|rcp)\b.*/i,
      /(\d{1,3}\.){3}\d{1,3}:(\d{1,5})/,
      /(wget|curl|nc|netcat).*\b(http|https|ftp):/
    ];

    this.customPatterns.set(ThreatType.SQL_INJECTION, sqlInjectionPatterns);
    this.customPatterns.set(ThreatType.XSS_ATTACK, xssPatterns);
    this.customPatterns.set(ThreatType.COMMAND_INJECTION, commandInjectionPatterns);
    this.customPatterns.set(ThreatType.PATH_TRAVERSAL, pathTraversalPatterns);
    this.customPatterns.set(ThreatType.CSRF_ATTACK, csrfPatterns);
    this.customPatterns.set(ThreatType.DATA_EXFILTRATION, exfiltrationPatterns);
  }

  /**
   * Detect threats using signature-based detection
   */
  detect(input: string, context: {
    ip: string;
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    userId?: string;
    sessionId?: string;
  }): ThreatDetection | null {
    const detections: Array<{ type: ThreatType; matches: string[]; confidence: number }> = [];

    // Check each threat type pattern
    for (const [threatType, patterns] of this.customPatterns.entries()) {
      const matches: string[] = [];
      let matchCount = 0;

      for (const pattern of patterns) {
        const found = input.match(pattern);
        if (found) {
          matches.push(...found.filter(m => m.length > 0));
          matchCount++;
        }
      }

      if (matches.length > 0) {
        const confidence = Math.min(matchCount / patterns.length, 1);
        detections.push({
          type: threatType,
          matches: [...new Set(matches)], // Unique matches
          confidence
        });
      }
    }

    if (detections.length === 0) {
      return null;
    }

    // Return the highest confidence detection
    const sorted = detections.sort((a, b) => b.confidence - a.confidence);
    const topDetection = sorted[0];

    return {
      id: generateId(),
      threatType: topDetection.type,
      detectionMethod: 'signature',
      severity: this.calculateSeverity(topDetection.type, topDetection.confidence),
      confidence: topDetection.confidence,
      timestamp: Date.now(),
      source: {
        ip: context.ip,
        userId: context.userId,
        sessionId: context.sessionId
      },
      target: {
        resource: context.path || 'unknown',
        endpoint: context.path,
        method: context.method
      },
      indicators: this.extractIndicators(topDetection.type, topDetection.matches),
      evidence: {
        matches: topDetection.matches,
        input: input.substring(0, 1000) // Limit input size
      },
      context: {
        requestHeaders: context.headers,
        path: context.path
      },
      matchedSignatures: topDetection.matches,
      isBlocked: topDetection.confidence > 0.7
    };
  }

  /**
   * Calculate severity based on threat type and confidence
   */
  private calculateSeverity(threatType: ThreatType, confidence: number): ThreatLevel {
    const criticalTypes = [ThreatType.SQL_INJECTION, ThreatType.COMMAND_INJECTION, ThreatType.RANSOMWARE];
    const highTypes = [ThreatType.XSS_ATTACK, ThreatType.DATA_EXFILTRATION, ThreatType.UNAUTHORIZED_ACCESS];

    if (criticalTypes.includes(threatType) && confidence > 0.5) {
      return 'critical';
    } else if (highTypes.includes(threatType) && confidence > 0.6) {
      return 'high';
    } else if (confidence > 0.7) {
      return 'high';
    } else if (confidence > 0.4) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Extract threat indicators from matches
   */
  private extractIndicators(threatType: ThreatType, matches: string[]): ThreatIndicator[] {
    const indicators: ThreatIndicator[] = [];

    for (const match of matches) {
      // Extract IP addresses
      const ipMatch = match.match(/(\d{1,3}\.){3}\d{1,3}/);
      if (ipMatch) {
        indicators.push({
          id: generateId(),
          type: 'ip',
          value: ipMatch[0],
          severity: 'medium',
          confidence: 0.8,
          source: 'signature_detection',
          description: `IP address detected in ${threatType}`,
          tags: [threatType],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          sightings: 1,
          isActive: true
        });
      }

      // Extract URLs
      const urlMatch = match.match(/https?:\/\/[^\s<>"]+/);
      if (urlMatch) {
        indicators.push({
          id: generateId(),
          type: 'url',
          value: urlMatch[0],
          severity: 'medium',
          confidence: 0.7,
          source: 'signature_detection',
          description: `URL detected in ${threatType}`,
          tags: [threatType],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          sightings: 1,
          isActive: true
        });
      }

      // Extract domains
      const domainMatch = match.match(/([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}/i);
      if (domainMatch) {
        indicators.push({
          id: generateId(),
          type: 'domain',
          value: domainMatch[0],
          severity: 'low',
          confidence: 0.6,
          source: 'signature_detection',
          description: `Domain detected in ${threatType}`,
          tags: [threatType],
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          sightings: 1,
          isActive: true
        });
      }
    }

    return indicators;
  }

  /**
   * Add custom signature
   */
  addSignature(signature: ThreatSignature): void {
    this.signatures.set(signature.id, signature);
  }

  /**
   * Remove signature
   */
  removeSignature(id: string): void {
    this.signatures.delete(id);
  }

  /**
   * Get all signatures
   */
  getSignatures(): ThreatSignature[] {
    return Array.from(this.signatures.values());
  }

  /**
   * Update signature
   */
  updateSignature(id: string, updates: Partial<ThreatSignature>): boolean {
    const signature = this.signatures.get(id);
    if (!signature) {
      return false;
    }

    this.signatures.set(id, {
      ...signature,
      ...updates,
      updatedAt: Date.now()
    });

    return true;
  }
}

// ============================================================================
// Anomaly-Based Detection
// ============================================================================

export class AnomalyDetector {
  private baselines: Map<string, AnomalyBaseline>;
  private metrics: Map<string, number[]>;
  private readonly DEFAULT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  private readonly DEFAULT_SAMPLES = 100;

  constructor() {
    this.baselines = new Map();
    this.metrics = new Map();
  }

  /**
   * Record metric value
   */
  recordMetric(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }

    const values = this.metrics.get(metric)!;
    values.push({ value, timestamp: Date.now() } as any);

    // Keep only recent values
    const maxSamples = this.DEFAULT_SAMPLES * 2;
    if (values.length > maxSamples) {
      values.splice(0, values.length - maxSamples);
    }

    // Update baseline if we have enough samples
    if (values.length >= this.DEFAULT_SAMPLES) {
      this.updateBaseline(metric);
    }
  }

  /**
   * Update baseline for metric
   */
  private updateBaseline(metric: string): void {
    const values = this.metrics.get(metric);
    if (!values || values.length < this.DEFAULT_SAMPLES) {
      return;
    }

    const recentValues = values.slice(-this.DEFAULT_SAMPLES);
    const numericValues = recentValues.map(v => typeof v === 'number' ? v : (v as any).value);

    const mean = this.calculateMean(numericValues);
    const stdDev = this.calculateStdDev(numericValues, mean);
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);

    const baseline: AnomalyBaseline = {
      metric,
      timeWindow: this.DEFAULT_WINDOW,
      thresholds: {
        mean,
        stdDev,
        min,
        max
      },
      dataSource: 'internal',
      lastUpdated: Date.now(),
      sampleSize: numericValues.length
    };

    this.baselines.set(metric, baseline);
  }

  /**
   * Detect anomalies in metric
   */
  detectAnomaly(metric: string, currentValue: number): AnomalyDetection | null {
    const baseline = this.baselines.get(metric);
    if (!baseline) {
      return null;
    }

    const { mean, stdDev, min, max } = baseline.thresholds;
    const zScore = Math.abs((currentValue - mean) / stdDev);

    // Determine severity based on deviation
    let severity: ThreatLevel;
    if (zScore > 5) {
      severity = 'critical';
    } else if (zScore > 4) {
      severity = 'high';
    } else if (zScore > 3) {
      severity = 'medium';
    } else if (zScore > 2) {
      severity = 'low';
    } else {
      return null; // Not anomalous enough
    }

    // Calculate expected range (3 standard deviations)
    const expectedMin = mean - 3 * stdDev;
    const expectedMax = mean + 3 * stdDev;

    return {
      id: generateId(),
      metric,
      currentValue,
      expectedRange: [expectedMin, expectedMax],
      deviationScore: zScore,
      severity,
      timestamp: Date.now(),
      description: `Anomaly detected in ${metric}: ${currentValue} (expected: ${expectedMin.toFixed(2)} - ${expectedMax.toFixed(2)})`,
      relatedMetrics: this.findRelatedMetrics(metric),
      contributingFactors: this.analyzeContributingFactors(metric, currentValue)
    };
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Find related metrics that might be correlated
   */
  private findRelatedMetrics(metric: string): string[] {
    // Simple implementation: return metrics with similar names
    const related: string[] = [];
    const baseName = metric.split('.')[0];

    for (const otherMetric of this.metrics.keys()) {
      if (otherMetric.startsWith(baseName) && otherMetric !== metric) {
        related.push(otherMetric);
      }
    }

    return related.slice(0, 5);
  }

  /**
   * Analyze contributing factors to anomaly
   */
  private analyzeContributingFactors(metric: string, value: number): string[] {
    const factors: string[] = [];
    const baseline = this.baselines.get(metric);

    if (!baseline) {
      return factors;
    }

    const { mean, min, max } = baseline.thresholds;

    if (value > max) {
      factors.push(`Value exceeds historical maximum (${max.toFixed(2)})`);
    } else if (value < min) {
      factors.push(`Value below historical minimum (${min.toFixed(2)})`);
    }

    if (value > mean * 2) {
      factors.push(`Value is more than 2x the historical average (${mean.toFixed(2)})`);
    }

    if (value < mean / 2) {
      factors.push(`Value is less than half the historical average (${mean.toFixed(2)})`);
    }

    return factors;
  }

  /**
   * Get baseline for metric
   */
  getBaseline(metric: string): AnomalyBaseline | null {
    return this.baselines.get(metric) || null;
  }

  /**
   * Get all baselines
   */
  getBaselines(): AnomalyBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Reset baseline for metric
   */
  resetBaseline(metric: string): void {
    this.baselines.delete(metric);
    this.metrics.delete(metric);
  }
}

// ============================================================================
// Behavioral Analysis
// ============================================================================

export interface BehaviorProfile {
  entityId: string;
  entityType: 'user' | 'system' | 'application';
  metrics: {
    loginCount: number;
    avgSessionDuration: number;
    uniqueLocations: number;
    dataTransferVolume: number;
    apiCallsPerHour: number;
    failedLoginAttempts: number;
  };
  patterns: {
    loginTimes: number[];
    loginLocations: string[];
    accessedResources: string[];
    typicalActions: string[];
  };
  riskScore: number;
  lastUpdated: number;
}

export class BehavioralAnalyzer {
  private profiles: Map<string, BehaviorProfile>;
  private eventHistory: Map<string, Array<{ timestamp: number; event: string; details: any }>>;

  constructor() {
    this.profiles = new Map();
    this.eventHistory = new Map();
  }

  /**
   * Analyze behavior for anomalies
   */
  analyzeBehavior(entityId: string, entityType: 'user' | 'system' | 'application', event: {
    action: string;
    resource: string;
    timestamp: number;
    location?: string;
    details: any;
  }): {
    isAnomalous: boolean;
    riskScore: number;
    reasons: string[];
  } {
    // Get or create profile
    let profile = this.profiles.get(entityId);
    if (!profile) {
      profile = this.createProfile(entityId, entityType);
      this.profiles.set(entityId, profile);
    }

    // Record event
    this.recordEvent(entityId, event);

    // Analyze for anomalies
    const reasons: string[] = [];
    let riskScore = 0;

    // Check login location
    if (event.location && profile.patterns.loginLocations.length > 0) {
      const knownLocations = new Set(profile.patterns.loginLocations);
      if (!knownLocations.has(event.location)) {
        reasons.push(`Login from new location: ${event.location}`);
        riskScore += 30;
      }
    }

    // Check login time
    if (event.action === 'login') {
      const hour = new Date(event.timestamp).getHours();
      const typicalHours = profile.patterns.loginTimes.map(t => new Date(t).getHours());
      if (typicalHours.length > 0) {
        const hourFreq = new Map<number, number>();
        typicalHours.forEach(h => hourFreq.set(h, (hourFreq.get(h) || 0) + 1));
        const maxFreq = Math.max(...hourFreq.values());
        const freqAtHour = hourFreq.get(hour) || 0;
        if (freqAtHour < maxFreq * 0.1) {
          reasons.push(`Login at unusual time: ${hour}:00`);
          riskScore += 20;
        }
      }
    }

    // Check resource access patterns
    if (profile.patterns.accessedResources.length > 0) {
      const knownResources = new Set(profile.patterns.accessedResources);
      if (!knownResources.has(event.resource) && event.action === 'access') {
        reasons.push(`Access to new resource: ${event.resource}`);
        riskScore += 25;
      }
    }

    // Check action frequency
    const recentEvents = this.eventHistory.get(entityId) || [];
    const recentSameActions = recentEvents.filter(
      e => e.event === event.action && e.timestamp > Date.now() - 3600000
    );
    if (recentSameActions.length > 100) {
      reasons.push(`Unusually high frequency of action: ${event.action}`);
      riskScore += 40;
    }

    // Update profile
    this.updateProfile(entityId, event);

    return {
      isAnomalous: riskScore > 50,
      riskScore: Math.min(riskScore, 100),
      reasons
    };
  }

  /**
   * Create new behavior profile
   */
  private createProfile(entityId: string, entityType: 'user' | 'system' | 'application'): BehaviorProfile {
    return {
      entityId,
      entityType,
      metrics: {
        loginCount: 0,
        avgSessionDuration: 0,
        uniqueLocations: 0,
        dataTransferVolume: 0,
        apiCallsPerHour: 0,
        failedLoginAttempts: 0
      },
      patterns: {
        loginTimes: [],
        loginLocations: [],
        accessedResources: [],
        typicalActions: []
      },
      riskScore: 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * Record event in history
   */
  private recordEvent(entityId: string, event: {
    action: string;
    resource: string;
    timestamp: number;
    location?: string;
    details: any;
  }): void {
    if (!this.eventHistory.has(entityId)) {
      this.eventHistory.set(entityId, []);
    }

    const history = this.eventHistory.get(entityId)!;
    history.push({
      timestamp: event.timestamp,
      event: event.action,
      details: event
    });

    // Keep only last 1000 events
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * Update behavior profile
   */
  private updateProfile(entityId: string, event: {
    action: string;
    resource: string;
    timestamp: number;
    location?: string;
    details: any;
  }): void {
    const profile = this.profiles.get(entityId);
    if (!profile) {
      return;
    }

    // Update metrics
    if (event.action === 'login') {
      profile.metrics.loginCount++;
    }

    if (event.details.dataTransferred) {
      profile.metrics.dataTransferVolume += event.details.dataTransferred;
    }

    // Update patterns
    if (event.action === 'login') {
      profile.patterns.loginTimes.push(event.timestamp);
      if (event.location && !profile.patterns.loginLocations.includes(event.location)) {
        profile.patterns.loginLocations.push(event.location);
        profile.metrics.uniqueLocations = profile.patterns.loginLocations.length;
      }
    }

    if (event.action === 'access' && !profile.patterns.accessedResources.includes(event.resource)) {
      profile.patterns.accessedResources.push(event.resource);
    }

    if (!profile.patterns.typicalActions.includes(event.action)) {
      profile.patterns.typicalActions.push(event.action);
    }

    profile.lastUpdated = Date.now();
  }

  /**
   * Get behavior profile
   */
  getProfile(entityId: string): BehaviorProfile | null {
    return this.profiles.get(entityId) || null;
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): BehaviorProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Calculate risk score for entity
   */
  calculateRiskScore(entityId: string): number {
    const profile = this.profiles.get(entityId);
    if (!profile) {
      return 0;
    }

    let riskScore = 0;

    // High number of failed logins
    if (profile.metrics.failedLoginAttempts > 5) {
      riskScore += 30;
    }

    // Many unique locations
    if (profile.metrics.uniqueLocations > 5) {
      riskScore += 20;
    }

    // High data transfer
    if (profile.metrics.dataTransferVolume > 1024 * 1024 * 1024) { // > 1GB
      riskScore += 25;
    }

    return Math.min(riskScore, 100);
  }
}

// ============================================================================
// Integrated Threat Detection Engine
// ============================================================================

export class ThreatDetectionEngine {
  private signatureDetector: SignatureDetector;
  private anomalyDetector: AnomalyDetector;
  private behavioralAnalyzer: BehavioralAnalyzer;

  constructor() {
    this.signatureDetector = new SignatureDetector();
    this.anomalyDetector = new AnomalyDetector();
    this.behavioralAnalyzer = new BehavioralAnalyzer();
  }

  /**
   * Analyze request for threats
   */
  analyzeRequest(request: {
    body?: any;
    query?: Record<string, string>;
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    ip: string;
    userId?: string;
    sessionId?: string;
  }): ThreatDetection[] {
    const detections: ThreatDetection[] = [];

    // Signature-based detection on request body
    if (request.body) {
      const bodyStr = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
      const detection = this.signatureDetector.detect(bodyStr, {
        ip: request.ip,
        path: request.path,
        method: request.method,
        headers: request.headers,
        userId: request.userId,
        sessionId: request.sessionId
      });

      if (detection) {
        detections.push(detection);
      }
    }

    // Signature-based detection on query parameters
    if (request.query) {
      const queryStr = JSON.stringify(request.query);
      const detection = this.signatureDetector.detect(queryStr, {
        ip: request.ip,
        path: request.path,
        method: request.method,
        headers: request.headers,
        userId: request.userId,
        sessionId: request.sessionId
      });

      if (detection) {
        detections.push(detection);
      }
    }

    // Behavioral analysis for authenticated users
    if (request.userId) {
      const behaviorAnalysis = this.behavioralAnalyzer.analyzeBehavior(
        request.userId,
        'user',
        {
          action: request.method?.toLowerCase() || 'request',
          resource: request.path || 'unknown',
          timestamp: Date.now(),
          details: {
            userAgent: request.headers?.['user-agent'],
            ip: request.ip
          }
        }
      );

      if (behaviorAnalysis.isAnomalous) {
        detections.push({
          id: generateId(),
          threatType: ThreatType.BEHAVIORAL_ANOMALY,
          detectionMethod: 'behavioral',
          severity: behaviorAnalysis.riskScore > 70 ? 'high' : 'medium',
          confidence: behaviorAnalysis.riskScore / 100,
          timestamp: Date.now(),
          source: {
            ip: request.ip,
            userId: request.userId,
            sessionId: request.sessionId
          },
          target: {
            resource: request.path || 'unknown',
            endpoint: request.path,
            method: request.method
          },
          indicators: [],
          evidence: {
            behavioralAnalysis,
            reasons: behaviorAnalysis.reasons
          },
          context: {
            requestHeaders: request.headers,
            path: request.path
          },
          matchedSignatures: [],
          behaviorScore: behaviorAnalysis.riskScore,
          isBlocked: behaviorAnalysis.riskScore > 70
        } as any);
      }
    }

    return detections;
  }

  /**
   * Record metric for anomaly detection
   */
  recordMetric(metric: string, value: number): void {
    this.anomalyDetector.recordMetric(metric, value);
  }

  /**
   * Check for metric anomalies
   */
  checkMetricAnomalies(metric: string, value: number): AnomalyDetection | null {
    return this.anomalyDetector.detectAnomaly(metric, value);
  }

  /**
   * Get signature detector
   */
  getSignatureDetector(): SignatureDetector {
    return this.signatureDetector;
  }

  /**
   * Get anomaly detector
   */
  getAnomalyDetector(): AnomalyDetector {
    return this.anomalyDetector;
  }

  /**
   * Get behavioral analyzer
   */
  getBehavioralAnalyzer(): BehavioralAnalyzer {
    return this.behavioralAnalyzer;
  }
}
