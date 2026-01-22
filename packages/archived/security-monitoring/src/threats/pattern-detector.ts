/**
 * Pattern-Based Detector
 * Detects threats using predefined patterns and signatures
 */

// Stub types for optional dependencies
interface Cache {
  get?(key: string): Promise<unknown>;
  set?(key: string, value: unknown): Promise<void>;
}

interface Client {
  search?(params: unknown): Promise<unknown>;
}

import {
  Threat,
  ThreatType,
  ThreatLevel,
  SecurityEventSeverity,
  EnrichedSecurityEvent,
  DetectionRule,
} from '../types';

export interface PatternDetectorConfig {
  cache?: Cache;
  elasticsearch?: Client;
}

export class PatternBasedDetector {
  private config: PatternDetectorConfig;
  private rules: DetectionRule[] = [];

  constructor(config: PatternDetectorConfig = {}) {
    this.config = config;
  }

  /**
   * Detect threats using pattern matching
   */
  public async detect(event: EnrichedSecurityEvent): Promise<Threat[]> {
    const threats: Threat[] = [];

    for (const rule of this.rules.filter(r => r.enabled)) {
      if (await this.matchesRule(event, rule)) {
        const threat = await this.createThreatFromRule(event, rule);
        threats.push(threat);
      }
    }

    return threats;
  }

  /**
   * Check if event matches rule
   */
  private async matchesRule(event: EnrichedSecurityEvent, rule: DetectionRule): Promise<boolean> {
    for (const condition of rule.conditions) {
      const matches = await this.matchesCondition(event, condition);
      if (condition.negate ? matches : !matches) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if event matches condition
   */
  private async matchesCondition(
    event: EnrichedSecurityEvent,
    condition: any
  ): Promise<boolean> {
    const value = this.getFieldValue(event, condition.field);

    switch (condition.operator) {
      case 'contains':
        return typeof value === 'string' && value.includes(condition.value);

      case 'equals':
        return value === condition.value;

      case 'matches':
        if (condition.value instanceof RegExp) {
          return typeof value === 'string' && condition.value.test(value);
        }
        if (typeof condition.value === 'string') {
          const regex = new RegExp(condition.value);
          return typeof value === 'string' && regex.test(value);
        }
        return false;

      case 'gt':
        return typeof value === 'number' && value > condition.value;

      case 'lt':
        return typeof value === 'number' && value < condition.value;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(value);

      default:
        return false;
    }
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
   * Create threat from rule
   */
  private async createThreatFromRule(
    event: EnrichedSecurityEvent,
    rule: DetectionRule
  ): Promise<Threat> {
    return {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.mapToThreatType(rule),
      level: this.mapSeverityToLevel(rule.severity),
      severity: rule.severity,
      status: 'detected',
      timestamp: new Date(),
      source: event.source,
      description: rule.description,
      indicators: [],
      affectedAssets: [event.resource || event.userId || 'unknown'],
      mitigation: rule.actions.find(a => a.type === 'block')?.config?.toString(),
      eventId: event.id,
      confidence: 1 - rule.falsePositiveRate,
      falsePositiveScore: rule.falsePositiveRate,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        matchedEvent: event.id,
      },
    };
  }

  /**
   * Map rule to threat type
   */
  private mapToThreatType(rule: DetectionRule): ThreatType {
    const name = rule.name.toLowerCase();

    if (name.includes('sql') || name.includes('injection')) {
      return ThreatType.SQL_INJECTION;
    }
    if (name.includes('xss')) {
      return ThreatType.XSS;
    }
    if (name.includes('csrf')) {
      return ThreatType.CSRF;
    }
    if (name.includes('brute') || name.includes('login')) {
      return ThreatType.BRUTE_FORCE;
    }
    if (name.includes('ddos')) {
      return ThreatType.DDOS;
    }
    if (name.includes('malware')) {
      return ThreatType.MALWARE;
    }
    if (name.includes('phishing')) {
      return ThreatType.PHISHING;
    }
    if (name.includes('path') || name.includes('traversal')) {
      return ThreatType.PATH_TRAVERSAL;
    }
    if (name.includes('command')) {
      return ThreatType.COMMAND_INJECTION;
    }

    return ThreatType.UNKNOWN;
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
   * Update rules
   */
  public async updateRules(rules: DetectionRule[]): Promise<void> {
    this.rules = rules.filter(r => r.type === 'pattern');
  }
}
