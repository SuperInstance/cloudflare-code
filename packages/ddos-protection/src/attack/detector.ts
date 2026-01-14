/**
 * Attack Detector
 * Detects various types of DDoS attacks using multiple detection strategies
 */

import type {
  RequestData,
  AttackDetection,
  AttackType,
  AnomalySeverity,
  MitigationAction,
  MitigationActionType,
  ImpactAssessment,
  AttackSignature
} from '../types';
import { TrafficAnalyzer } from '../traffic/analyzer';
import { IPUtils, MathUtils, TimeUtils, StringUtils } from '../utils';

/**
 * Detection configuration
 */
interface DetectionConfig {
  volumetricThreshold: number; // requests per second
  errorRateThreshold: number; // 0-1
  botThreshold: number; // 0-1
  connectionThreshold: number; // concurrent connections
  signatureMatching: boolean;
  behavioralAnalysis: boolean;
}

/**
 * Detection result
 */
interface DetectionResult {
  isAttack: boolean;
  attackType: AttackType;
  confidence: number;
  severity: AnomalySeverity;
  sourceIps: string[];
  affectedEndpoints: string[];
}

/**
 * Attack Detector class
 */
export class AttackDetector {
  private trafficAnalyzer: TrafficAnalyzer;
  private signatures: Map<string, AttackSignature>;
  private activeAttacks: Map<string, AttackDetection>;
  private config: DetectionConfig;
  private detectionHistory: AttackDetection[];

  constructor(
    trafficAnalyzer: TrafficAnalyzer,
    config: Partial<DetectionConfig> = {}
  ) {
    this.trafficAnalyzer = trafficAnalyzer;
    this.signatures = new Map();
    this.activeAttacks = new Map();
    this.detectionHistory = [];
    this.config = {
      volumetricThreshold: config.volumetricThreshold || 1000,
      errorRateThreshold: config.errorRateThreshold || 0.5,
      botThreshold: config.botThreshold || 0.7,
      connectionThreshold: config.connectionThreshold || 100,
      signatureMatching: config.signatureMatching !== false,
      behavioralAnalysis: config.behavioralAnalysis !== false
    };

    this.initializeDefaultSignatures();
  }

  /**
   * Analyze request for attack indicators
   */
  async analyzeRequest(request: RequestData): Promise<AttackDetection | null> {
    // Get traffic analysis
    const trafficAnalysis = await this.trafficAnalyzer.processRequest(request);

    // Check for active attacks
    if (this.activeAttacks.size > 0) {
      const existingAttack = this.updateExistingAttack(trafficAnalysis);
      if (existingAttack) {
        return existingAttack;
      }
    }

    // Perform detection
    const detection = await this.performDetection(trafficAnalysis, request);

    if (detection.isAttack) {
      return this.createAttackDetection(detection, trafficAnalysis);
    }

    return null;
  }

  /**
   * Perform multi-layered attack detection
   */
  private async performDetection(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    const detectionMethods = [
      this.detectVolumetricAttack.bind(this),
      this.detectApplicationAttack.bind(this),
      this.detectProtocolAttack.bind(this),
      this.detectBotAttack.bind(this),
      this.detectSignatureMatch.bind(this),
      this.detectBehavioralAnomaly.bind(this)
    ];

    const results = await Promise.all(
      detectionMethods.map(method => method(trafficAnalysis, request))
    );

    // Find highest confidence detection
    let bestResult: DetectionResult | null = null;
    for (const result of results) {
      if (result.isAttack && (!bestResult || result.confidence > bestResult.confidence)) {
        bestResult = result;
      }
    }

    return bestResult || {
      isAttack: false,
      attackType: 'unknown' as AttackType,
      confidence: 0,
      severity: 'low' as AnomalySeverity,
      sourceIps: [],
      affectedEndpoints: []
    };
  }

  /**
   * Detect volumetric attacks (high volume traffic)
   */
  private async detectVolumetricAttack(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    const { metrics } = trafficAnalysis;
    const rps = metrics.requestsPerSecond;

    if (rps < this.config.volumetricThreshold) {
      return {
        isAttack: false,
        attackType: 'volumetric' as AttackType,
        confidence: 0,
        severity: 'low' as AnomalySeverity,
        sourceIps: [],
        affectedEndpoints: []
      };
    }

    // Determine severity
    let severity: AnomalySeverity = 'low';
    if (rps > 10000) severity = 'critical';
    else if (rps > 5000) severity = 'high';
    else if (rps > 2000) severity = 'medium';

    // Calculate confidence based on how far above threshold
    const confidence = Math.min((rps / (this.config.volumetricThreshold * 5)), 1.0);

    // Identify source IPs
    const ipDistribution = this.getTopIPs(10);
    const sourceIps = ipDistribution.slice(0, 5).map(ip => ip.ip);

    // Identify affected endpoints
    const affectedEndpoints = metrics.topPaths
      .filter((p: any) => p.count > rps * 10)
      .map((p: any) => p.path);

    return {
      isAttack: true,
      attackType: 'volumetric' as AttackType,
      confidence,
      severity,
      sourceIps,
      affectedEndpoints
    };
  }

  /**
   * Detect application-layer attacks
   */
  private async detectApplicationAttack(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    const { metrics, anomalies } = trafficAnalysis;

    // Check for high error rate
    if (metrics.errorRate > this.config.errorRateThreshold) {
      return {
        isAttack: true,
        attackType: 'application' as AttackType,
        confidence: Math.min(metrics.errorRate + 0.2, 1.0),
        severity: metrics.errorRate > 0.8 ? 'critical' : 'high' as AnomalySeverity,
        sourceIps: this.getTopIPs(5).map(ip => ip.ip),
        affectedEndpoints: metrics.topPaths.map((p: any) => p.path)
      };
    }

    // Check for HTTP flood patterns
    const httpFloodIndicators = this.detectHTTPFlood(metrics);
    if (httpFloodIndicators.detected) {
      return {
        isAttack: true,
        attackType: 'http_flood' as AttackType,
        confidence: httpFloodIndicators.confidence,
        severity: 'high' as AnomalySeverity,
        sourceIps: httpFloodIndicators.sourceIps,
        affectedEndpoints: httpFloodIndicators.endpoints
      };
    }

    // Check for Slowloris patterns
    const slowlorisIndicators = this.detectSlowloris(metrics);
    if (slowlorisIndicators.detected) {
      return {
        isAttack: true,
        attackType: 'slowloris' as AttackType,
        confidence: slowlorisIndicators.confidence,
        severity: 'medium' as AnomalySeverity,
        sourceIps: slowlorisIndicators.sourceIps,
        affectedEndpoints: []
      };
    }

    return {
      isAttack: false,
      attackType: 'application' as AttackType,
      confidence: 0,
      severity: 'low' as AnomalySeverity,
      sourceIps: [],
      affectedEndpoints: []
    };
  }

  /**
   * Detect protocol attacks
   */
  private async detectProtocolAttack(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    // Check for SYN flood indicators (simplified)
    const synFloodIndicators = this.detectSYNFlood(trafficAnalysis);
    if (synFloodIndicators.detected) {
      return {
        isAttack: true,
        attackType: 'syn_flood' as AttackType,
        confidence: synFloodIndicators.confidence,
        severity: 'high' as AnomalySeverity,
        sourceIps: synFloodIndicators.sourceIps,
        affectedEndpoints: []
      };
    }

    // Check for UDP flood indicators
    const udpFloodIndicators = this.detectUDPFlood(trafficAnalysis);
    if (udpFloodIndicators.detected) {
      return {
        isAttack: true,
        attackType: 'udp_flood' as AttackType,
        confidence: udpFloodIndicators.confidence,
        severity: 'high' as AnomalySeverity,
        sourceIps: udpFloodIndicators.sourceIps,
        affectedEndpoints: []
      };
    }

    // Check for amplification attacks
    const amplificationIndicators = this.detectAmplificationAttack(trafficAnalysis);
    if (amplificationIndicators.detected) {
      return {
        isAttack: true,
        attackType: amplificationIndicators.attackType,
        confidence: amplificationIndicators.confidence,
        severity: 'critical' as AnomalySeverity,
        sourceIps: amplificationIndicators.sourceIps,
        affectedEndpoints: []
      };
    }

    return {
      isAttack: false,
      attackType: 'protocol' as AttackType,
      confidence: 0,
      severity: 'low' as AnomalySeverity,
      sourceIps: [],
      affectedEndpoints: []
    };
  }

  /**
   * Detect bot attacks
   */
  private async detectBotAttack(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    const { metrics } = trafficAnalysis;

    // Calculate bot ratio
    const botTraffic = metrics.topUserAgents
      .filter((ua: any) => ua.isBot)
      .reduce((sum: number, ua: any) => sum + ua.count, 0);

    const botRatio = metrics.totalRequests > 0 ? botTraffic / metrics.totalRequests : 0;

    if (botRatio > this.config.botThreshold) {
      const severity = botRatio > 0.9 ? 'critical' : botRatio > 0.8 ? 'high' : 'medium';

      return {
        isAttack: true,
        attackType: 'bot' as AttackType,
        confidence: botRatio,
        severity: severity as AnomalySeverity,
        sourceIps: this.getTopIPs(10).map(ip => ip.ip),
        affectedEndpoints: metrics.topPaths.map((p: any) => p.path)
      };
    }

    return {
      isAttack: false,
      attackType: 'bot' as AttackType,
      confidence: 0,
      severity: 'low' as AnomalySeverity,
      sourceIps: [],
      affectedEndpoints: []
    };
  }

  /**
   * Detect attack signature matches
   */
  private async detectSignatureMatch(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    if (!this.config.signatureMatching) {
      return {
        isAttack: false,
        attackType: 'unknown' as AttackType,
        confidence: 0,
        severity: 'low' as AnomalySeverity,
        sourceIps: [],
        affectedEndpoints: []
      };
    }

    for (const signature of this.signatures.values()) {
      if (this.matchesSignature(request, signature)) {
        return {
          isAttack: true,
          attackType: signature.attackType,
          confidence: 0.9,
          severity: signature.severity,
          sourceIps: [request.ip],
          affectedEndpoints: [request.url]
        };
      }
    }

    return {
      isAttack: false,
      attackType: 'unknown' as AttackType,
      confidence: 0,
      severity: 'low' as AnomalySeverity,
      sourceIps: [],
      affectedEndpoints: []
    };
  }

  /**
   * Detect behavioral anomalies
   */
  private async detectBehavioralAnomaly(
    trafficAnalysis: any,
    request: RequestData
  ): Promise<DetectionResult> {
    if (!this.config.behavioralAnalysis) {
      return {
        isAttack: false,
        attackType: 'unknown' as AttackType,
        confidence: 0,
        severity: 'low' as AnomalySeverity,
        sourceIps: [],
        affectedEndpoints: []
      };
    }

    const { patterns } = trafficAnalysis;

    // Check behavioral score
    if (patterns.behavioralScore < 0.3) {
      return {
        isAttack: true,
        attackType: 'bot' as AttackType,
        confidence: 1 - patterns.behavioralScore,
        severity: 'high' as AnomalySeverity,
        sourceIps: [request.ip],
        affectedEndpoints: [request.url]
      };
    }

    return {
      isAttack: false,
      attackType: 'unknown' as AttackType,
      confidence: 0,
      severity: 'low' as AnomalySeverity,
      sourceIps: [],
      affectedEndpoints: []
    };
  }

  /**
   * Detect HTTP flood patterns
   */
  private detectHTTPFlood(metrics: any): {
    detected: boolean;
    confidence: number;
    sourceIps: string[];
    endpoints: string[];
  } {
    const topIPs = this.getTopIPs(5);
    const topPath = metrics.topPaths[0];

    if (!topPath || topIPs.length === 0) {
      return { detected: false, confidence: 0, sourceIps: [], endpoints: [] };
    }

    // Check if single IP is making excessive requests
    const topIPRatio = topIPs[0].count / metrics.totalRequests;
    const isSingleSource = topIPRatio > 0.3;

    // Check if requests are concentrated on single endpoint
    const topPathRatio = topPath.count / metrics.totalRequests;
    const isTargeted = topPathRatio > 0.5;

    if (isSingleSource && isTargeted) {
      return {
        detected: true,
        confidence: topIPRatio + topPathRatio,
        sourceIps: [topIPs[0].ip],
        endpoints: [topPath.path]
      };
    }

    return { detected: false, confidence: 0, sourceIps: [], endpoints: [] };
  }

  /**
   * Detect Slowloris attack patterns
   */
  private detectSlowloris(metrics: any): {
    detected: boolean;
    confidence: number;
    sourceIps: string[];
  } {
    // Slowloris is characterized by many slow connections
    // Check for high number of concurrent connections with slow response times

    const topIPs = this.getTopIPs(10);

    for (const ipData of topIPs) {
      // Check if this IP has many slow connections
      const ipMetrics = this.getIPMetrics(ipData.ip);
      if (ipMetrics.slowConnectionRatio > 0.8) {
        return {
          detected: true,
          confidence: ipMetrics.slowConnectionRatio,
          sourceIps: [ipData.ip]
        };
      }
    }

    return { detected: false, confidence: 0, sourceIps: [] };
  }

  /**
   * Detect SYN flood patterns
   */
  private detectSYNFlood(trafficAnalysis: any): {
    detected: boolean;
    confidence: number;
    sourceIps: string[];
  } {
    // SYN flood detection requires connection-level metrics
    // For now, use request rate as a proxy

    const { metrics } = trafficAnalysis;
    if (metrics.requestsPerSecond > 5000) {
      return {
        detected: true,
        confidence: Math.min(metrics.requestsPerSecond / 10000, 1.0),
        sourceIps: this.getTopIPs(5).map(ip => ip.ip)
      };
    }

    return { detected: false, confidence: 0, sourceIps: [] };
  }

  /**
   * Detect UDP flood patterns
   */
  private detectUDPFlood(trafficAnalysis: any): {
    detected: boolean;
    confidence: number;
    sourceIps: string[];
  } {
    // UDP flood detection at application layer is limited
    // This is a placeholder for network-level detection

    return { detected: false, confidence: 0, sourceIps: [] };
  }

  /**
   * Detect amplification attacks
   */
  private detectAmplificationAttack(trafficAnalysis: any): {
    detected: boolean;
    attackType: AttackType;
    confidence: number;
    sourceIps: string[];
  } {
    const { metrics } = trafficAnalysis;

    // Check for DNS amplification patterns (small request, large response)
    const avgRequestSize = this.getAverageRequestSize();
    const avgResponseSize = this.getAverageResponseSize();

    if (avgResponseSize > avgRequestSize * 10) {
      return {
        detected: true,
        attackType: 'dns_amplification' as AttackType,
        confidence: Math.min((avgResponseSize / avgRequestSize) / 100, 1.0),
        sourceIps: this.getTopIPs(10).map(ip => ip.ip)
      };
    }

    return { detected: false, attackType: 'unknown' as AttackType, confidence: 0, sourceIps: [] };
  }

  /**
   * Check if request matches signature
   */
  private matchesSignature(request: RequestData, signature: AttackSignature): boolean {
    try {
      const pattern = signature.pattern instanceof RegExp
        ? signature.pattern
        : new RegExp(signature.pattern, 'i');

      // Check URL
      if (pattern.test(request.url)) {
        return true;
      }

      // Check headers
      for (const [key, value] of Object.entries(request.headers)) {
        if (pattern.test(`${key}: ${value}`)) {
          return true;
        }
      }

      // Check user agent
      if (pattern.test(request.userAgent)) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Create attack detection object
   */
  private createAttackDetection(
    detection: DetectionResult,
    trafficAnalysis: any
  ): AttackDetection {
    const id = StringUtils.uuid();
    const attackDetection: AttackDetection = {
      id,
      isAttack: detection.isAttack,
      attackType: detection.attackType,
      confidence: detection.confidence,
      severity: detection.severity,
      sourceIps: detection.sourceIps,
      affectedEndpoints: detection.affectedEndpoints,
      estimatedImpact: this.estimateImpact(trafficAnalysis, detection),
      mitigationRecommended: this.recommendMitigation(detection),
      timestamp: TimeUtils.now()
    };

    // Store active attack
    this.activeAttacks.set(id, attackDetection);
    this.detectionHistory.push(attackDetection);

    return attackDetection;
  }

  /**
   * Update existing attack
   */
  private updateExistingAttack(trafficAnalysis: any): AttackDetection | null {
    for (const [id, attack] of this.activeAttacks) {
      const age = TimeUtils.now() - attack.timestamp;

      // Update if attack is still active
      if (age < 300000) { // 5 minutes
        attack.timestamp = TimeUtils.now();
        attack.estimatedImpact = this.estimateImpact(trafficAnalysis, attack);
        return attack;
      } else {
        // Remove old attacks
        this.activeAttacks.delete(id);
      }
    }

    return null;
  }

  /**
   * Estimate attack impact
   */
  private estimateImpact(
    trafficAnalysis: any,
    detection: DetectionResult | AttackDetection
  ): ImpactAssessment {
    const { metrics } = trafficAnalysis;

    // Calculate availability impact (0-1)
    const availabilityImpact = Math.min(
      (metrics.requestsPerSecond - this.config.volumetricThreshold) /
      (this.config.volumetricThreshold * 10),
      1.0
    );

    // Calculate performance impact
    const performanceImpact = Math.min(
      metrics.averageResponseTime / 10000,
      1.0
    );

    // Calculate resource usage
    const resourceUsage = Math.min(
      metrics.requestsPerSecond / (this.config.volumetricThreshold * 5),
      1.0
    );

    // Estimate traffic loss
    const estimatedTrafficLoss = Math.max(
      (metrics.errorRate - 0.01) * 100,
      0
    );

    return {
      availabilityImpact,
      performanceImpact,
      resourceUsage,
      estimatedTrafficLoss
    };
  }

  /**
   * Recommend mitigation actions
   */
  private recommendMitigation(
    detection: DetectionResult | AttackDetection
  ): MitigationAction[] {
    const actions: MitigationAction[] = [];
    const severity = detection.severity;
    const attackType = detection.attackType;

    // Base actions on severity
    if (severity === 'critical' || severity === 'high') {
      actions.push({
        type: 'rate_limit' as MitigationActionType,
        target: 'global',
        parameters: {
          requestsPerSecond: Math.floor(this.config.volumetricThreshold * 0.5)
        },
        priority: 1,
        timestamp: TimeUtils.now()
      });
    }

    // Type-specific actions
    if (attackType === 'volumetric' || attackType === 'http_flood') {
      actions.push({
        type: 'ip_block' as MitigationActionType,
        target: detection.sourceIps.join(','),
        parameters: { duration: 3600 },
        priority: 2,
        timestamp: TimeUtils.now()
      });
    }

    if (attackType === 'bot') {
      actions.push({
        type: 'challenge' as MitigationActionType,
        target: 'global',
        parameters: { challengeType: 'javascript' },
        priority: 1,
        timestamp: TimeUtils.now()
      });
    }

    if (attackType === 'application') {
      actions.push({
        type: 'captcha' as MitigationActionType,
        target: detection.affectedEndpoints.join(','),
        parameters: { challengeType: 'hcaptcha' },
        priority: 2,
        timestamp: TimeUtils.now()
      });
    }

    return actions;
  }

  /**
   * Get top IPs by request count
   */
  private getTopIPs(limit: number): Array<{ ip: string; count: number }> {
    const stats = this.trafficAnalyzer.getState();
    // Simplified - in real implementation, get from analyzer
    return [];
  }

  /**
   * Get IP-specific metrics
   */
  private getIPMetrics(ip: string): {
    totalRequests: number;
    slowConnectionRatio: number;
    errorRate: number;
  } {
    // Placeholder - in real implementation, track per-IP metrics
    return {
      totalRequests: 0,
      slowConnectionRatio: 0,
      errorRate: 0
    };
  }

  /**
   * Get average request size
   */
  private getAverageRequestSize(): number {
    // Placeholder - in real implementation, track request sizes
    return 1000;
  }

  /**
   * Get average response size
   */
  private getAverageResponseSize(): number {
    // Placeholder - in real implementation, track response sizes
    return 5000;
  }

  /**
   * Initialize default attack signatures
   */
  private initializeDefaultSignatures(): void {
    const defaultSignatures: AttackSignature[] = [
      {
        id: 'sql-injection-1',
        name: 'SQL Injection Pattern',
        pattern: /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
        attackType: 'application' as AttackType,
        severity: 'high' as AnomalySeverity,
        description: 'Common SQL injection patterns',
        mitigationAction: 'block' as MitigationActionType
      },
      {
        id: 'xss-1',
        name: 'XSS Pattern',
        pattern: /<script|javascript:|onerror=|onload=/i,
        attackType: 'application' as AttackType,
        severity: 'high' as AnomalySeverity,
        description: 'Cross-site scripting patterns',
        mitigationAction: 'block' as MitigationActionType
      },
      {
        id: 'path-traversal-1',
        name: 'Path Traversal',
        pattern: /\.\.\/|\.\.\\|%2e%2e/i,
        attackType: 'application' as AttackType,
        severity: 'critical' as AnomalySeverity,
        description: 'Path traversal attempts',
        mitigationAction: 'block' as MitigationActionType
      },
      {
        id: 'user-agent-bot-1',
        name: 'Known Bad Bot',
        pattern: /(scanner|crawler|spider|bot|curl|wget|python-requests)/i,
        attackType: 'bot' as AttackType,
        severity: 'medium' as AnomalySeverity,
        description: 'Known bot user agents',
        mitigationAction: 'challenge' as MitigationActionType
      },
      {
        id: 'ddos-tool-1',
        name: 'DDoS Tool Signature',
        pattern: /(loic|hoic|slowloris|xddos|pybot)/i,
        attackType: 'volumetric' as AttackType,
        severity: 'critical' as AnomalySeverity,
        description: 'Known DDoS tool signatures',
        mitigationAction: 'block' as MitigationActionType
      }
    ];

    for (const signature of defaultSignatures) {
      this.signatures.set(signature.id, signature);
    }
  }

  /**
   * Add custom signature
   */
  addSignature(signature: AttackSignature): void {
    this.signatures.set(signature.id, signature);
  }

  /**
   * Remove signature
   */
  removeSignature(id: string): boolean {
    return this.signatures.delete(id);
  }

  /**
   * Get active attacks
   */
  getActiveAttacks(): AttackDetection[] {
    return Array.from(this.activeAttacks.values());
  }

  /**
   * Get detection history
   */
  getDetectionHistory(): AttackDetection[] {
    return [...this.detectionHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.detectionHistory = [];
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get configuration
   */
  getConfig(): DetectionConfig {
    return { ...this.config };
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.activeAttacks.clear();
    this.detectionHistory = [];
  }
}
