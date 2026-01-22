/**
 * ML-Based Detector
 * Detects threats using machine learning models
 */

// Stub types for optional dependencies
interface Cache {
  get?(key: string): Promise<unknown>;
  set?(key: string, value: unknown): Promise<void>;
}

import { EnrichedSecurityEvent, Threat, ThreatType, ThreatLevel, SecurityEventSeverity, DetectionRule } from '../types';

export interface MLDetectorConfig {
  modelPath?: string;
  cache?: Cache;
}

export class MLBasedDetector {
  private config: MLDetectorConfig;
  private rules: DetectionRule[] = [];
  private model: unknown = null;

  constructor(config: MLDetectorConfig = {}) {
    this.config = config;
  }

  /**
   * Detect threats using ML models
   */
  public async detect(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    try {
      // Load model if not loaded
      if (!this.model) {
        await this.loadModel();
      }

      // Extract features from event
      const features = this.extractFeatures(event);

      // Make prediction
      const prediction = await this.predict(features) as {
        isThreat?: boolean;
        confidence?: number;
        threatType?: ThreatType;
        reason?: string;
      };

      // If prediction indicates threat
      if (prediction.isThreat && (prediction.confidence ?? 0) > 0.7) {
        threats.push({
          id: `threat_ml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: prediction.threatType || ThreatType.UNKNOWN,
          level: this.getLevelFromConfidence(prediction.confidence ?? 0),
          severity: this.getSeverityFromConfidence(prediction.confidence ?? 0),
          status: 'detected',
          timestamp: new Date(),
          source: event.source,
          description: `ML-based detection: ${prediction.reason}`,
          indicators: [],
          affectedAssets: [event.resource || event.userId || 'unknown'],
          eventId: event.id,
          confidence: prediction.confidence ?? 0,
          falsePositiveScore: 1 - (prediction.confidence ?? 0),
          metadata: {
            detectionMethod: 'ml',
            modelFeatures: features,
            prediction,
          },
        });
      }

      // Check ML-based rules
      for (const rule of this.rules.filter(r => r.enabled)) {
        if (await this.matchesMLRule(event, rule, prediction)) {
          const threat = await this.createThreatFromML(event, rule, prediction);
          threats.push(threat);
        }
      }
    } catch (error) {
      console.error('Error in ML detection:', error);
    }

    return threats;
  }

  /**
   * Load ML model
   */
  private async loadModel(): Promise<void> {
    // Mock implementation - in production, load actual ML model
    // This could be a TensorFlow.js model, ONNX model, or custom model
    this.model = {
      predict: async (features: number[]) => {
        // Simple heuristic-based prediction for demo
        const riskScore = features[0] || 0;
        const isThreat = riskScore > 50;
        return {
          isThreat,
          confidence: Math.min(1, riskScore / 100),
          threatType: isThreat ? ThreatType.UNKNOWN : undefined,
          reason: isThreat ? 'High risk score detected' : 'Normal activity',
        };
      },
    };
  }

  /**
   * Extract features from event
   */
  private extractFeatures(event: EnrichedSecurityEvent): number[] {
    const features: number[] = [];

    // Risk score
    features.push(event.riskScore);

    // Hour of day
    features.push(event.timestamp.getHours());

    // Day of week
    features.push(event.timestamp.getDay());

    // Event type (one-hot encoding simplified)
    const typeHash = this.simpleHash(event.type);
    features.push(typeHash % 100);

    // Severity (numeric)
    const severityMap: Record<string, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };
    features.push(severityMap[event.severity] || 0);

    // Outcome (numeric)
    const outcomeMap: Record<string, number> = {
      success: 1,
      failure: 0,
      partial: 0.5,
    };
    features.push(outcomeMap[event.outcome]);

    // Has user
    features.push(event.userId ? 1 : 0);

    // Has IP
    features.push(event.ipAddress ? 1 : 0);

    // Tags count
    features.push(event.tags?.length || 0);

    // Enriched
    features.push(event.enriched ? 1 : 0);

    // Has geo location
    features.push(event.enrichmentData?.geoLocation ? 1 : 0);

    // Has threat intel
    features.push(event.enrichmentData?.threatIntelligence?.knownAttacker ? 1 : 0);

    return features;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Make prediction
   */
  private async predict(features: number[]): Promise<unknown> {
    if (!this.model) {
      await this.loadModel();
    }

    const model = this.model as { predict(features: number[]): Promise<unknown> };
    return await model.predict(features);
  }

  /**
   * Check if event matches ML rule
   */
  private async matchesMLRule(
    event: EnrichedSecurityEvent,
    rule: DetectionRule,
    prediction: any
  ): Promise<boolean> {
    // ML-specific rule matching logic
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(event, condition.field);
      const conditionValue = condition.value as unknown;

      switch (condition.operator) {
        case 'equals':
          if (value !== conditionValue) return false;
          break;
        case 'gt':
          if (typeof value !== 'number' || value <= (conditionValue as number)) return false;
          break;
        case 'lt':
          if (typeof value !== 'number' || value >= (conditionValue as number)) return false;
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
   * Create threat from ML detection
   */
  private async createThreatFromML(
    event: EnrichedSecurityEvent,
    rule: DetectionRule,
    prediction: any
  ): Promise<Threat> {
    return {
      id: `threat_ml_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      confidence: prediction.confidence,
      falsePositiveScore: 1 - prediction.confidence,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        prediction,
      },
    };
  }

  /**
   * Get level from confidence
   */
  private getLevelFromConfidence(confidence: number): ThreatLevel {
    if (confidence >= 0.9) return ThreatLevel.CRITICAL;
    if (confidence >= 0.8) return ThreatLevel.HIGH;
    if (confidence >= 0.7) return ThreatLevel.MEDIUM;
    if (confidence >= 0.6) return ThreatLevel.LOW;
    return ThreatLevel.MINIMAL;
  }

  /**
   * Get severity from confidence
   */
  private getSeverityFromConfidence(confidence: number): SecurityEventSeverity {
    if (confidence >= 0.9) return SecurityEventSeverity.CRITICAL;
    if (confidence >= 0.8) return SecurityEventSeverity.HIGH;
    if (confidence >= 0.7) return SecurityEventSeverity.MEDIUM;
    if (confidence >= 0.6) return SecurityEventSeverity.LOW;
    return SecurityEventSeverity.INFO;
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
   * Update ML models
   */
  public async updateModels(): Promise<void> {
    // In production, retrain or update ML models with new data
    console.log('Updating ML models...');
  }

  /**
   * Update rules
   */
  public async updateRules(rules: DetectionRule[]): Promise<void> {
    this.rules = rules.filter(r => r.type === 'ml');
  }
}
