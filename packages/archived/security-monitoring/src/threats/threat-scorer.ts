/**
 * Threat Scorer
 * Scores threats and determines their threat level
 */

import { Threat, ThreatLevel, SecurityEventSeverity } from '../types';

export interface ThreatScorerConfig {
  defaultThreshold?: number;
  highRiskThreshold?: number;
  criticalThreshold?: number;
}

export class ThreatScorer {
  private config: Required<ThreatScorerConfig>;

  constructor(config: ThreatScorerConfig = {}) {
    this.config = {
      defaultThreshold: 50,
      highRiskThreshold: 70,
      criticalThreshold: 90,
      ...config,
    };
  }

  /**
   * Score a threat and determine its level
   */
  public async score(threat: Threat): Promise<Threat> {
    let score = 0;

    // Base score from confidence
    score += threat.confidence * 30;

    // Subtract false positive score
    score -= threat.falsePositiveScore * 20;

    // Score based on severity
    score += this.getSeverityScore(threat.severity);

    // Score based on affected assets
    score += Math.min(threat.affectedAssets.length * 5, 20);

    // Score based on indicators
    score += Math.min(threat.indicators.length * 3, 15);

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine threat level
    const level = this.getLevelFromScore(score);

    return {
      ...threat,
      level,
    };
  }

  /**
   * Get severity score
   */
  private getSeverityScore(severity: SecurityEventSeverity): number {
    const scores: Record<SecurityEventSeverity, number> = {
      [SecurityEventSeverity.CRITICAL]: 30,
      [SecurityEventSeverity.HIGH]: 25,
      [SecurityEventSeverity.MEDIUM]: 15,
      [SecurityEventSeverity.LOW]: 5,
      [SecurityEventSeverity.INFO]: 0,
    };

    return scores[severity] || 0;
  }

  /**
   * Get threat level from score
   */
  private getLevelFromScore(score: number): ThreatLevel {
    if (score >= this.config.criticalThreshold) {
      return ThreatLevel.CRITICAL;
    }
    if (score >= this.config.highRiskThreshold) {
      return ThreatLevel.HIGH;
    }
    if (score >= this.config.defaultThreshold) {
      return ThreatLevel.MEDIUM;
    }
    if (score >= 30) {
      return ThreatLevel.LOW;
    }
    return ThreatLevel.MINIMAL;
  }

  /**
   * Calculate risk score for multiple threats
   */
  public calculateAggregateRisk(threats: Threat[]): number {
    if (threats.length === 0) {
      return 0;
    }

    const totalScore = threats.reduce((sum, threat) => {
      return sum + this.getNumericLevel(threat.level);
    }, 0);

    return Math.min(100, totalScore / threats.length * 20);
  }

  /**
   * Get numeric value for threat level
   */
  private getNumericLevel(level: ThreatLevel): number {
    return level;
  }
}
