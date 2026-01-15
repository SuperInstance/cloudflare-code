/**
 * Event Validator
 * Validates security events against schema and business rules
 */

import { SecurityEvent, SecurityEventSchema } from '../types';

export class EventValidator {
  /**
   * Validate a security event
   */
  public async validate(event: SecurityEvent): Promise<void> {
    // Validate against schema
    const result = SecurityEventSchema.safeParse(event);

    if (!result.success) {
      throw new Error(`Event validation failed: ${result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    }

    // Business rule validations
    await this.validateBusinessRules(event);
  }

  /**
   * Validate business rules
   */
  private async validateBusinessRules(event: SecurityEvent): Promise<void> {
    // Validate timestamp is not in the future (with 5 minute tolerance for clock skew)
    const now = new Date();
    const maxFutureTime = new Date(now.getTime() + 5 * 60 * 1000);

    if (event.timestamp > maxFutureTime) {
      throw new Error('Event timestamp is too far in the future');
    }

    // Validate timestamp is not too old (more than 30 days)
    const maxPastTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (event.timestamp < maxPastTime) {
      throw new Error('Event timestamp is too old');
    }

    // Validate source is not empty
    if (!event.source || event.source.trim().length === 0) {
      throw new Error('Event source cannot be empty');
    }

    // Validate ID format
    if (!event.id || event.id.trim().length === 0) {
      throw new Error('Event ID cannot be empty');
    }

    // Validate outcome
    if (!['success', 'failure', 'partial'].includes(event.outcome)) {
      throw new Error('Invalid event outcome');
    }

    // Validate severity matches event type (warning only)
    const expectedSeverity = this.getExpectedSeverity(event.type);
    if (this.isLowerSeverity(event.severity, expectedSeverity)) {
      console.warn(`Event severity ${event.severity} is lower than expected ${expectedSeverity} for type ${event.type}`);
    }
  }

  /**
   * Get expected severity for event type
   */
  private getExpectedSeverity(type: string): string {
    const severityMap: Record<string, string> = {
      'auth.login.failure': 'medium',
      'auth.privilege.escalation': 'high',
      'access.denied': 'medium',
      'ddos.attempt': 'critical',
      'intrusion.detected': 'critical',
      'malware.detected': 'critical',
      'threat.detected': 'high',
      'vuln.discovered': 'high',
      'incident.created': 'high',
    };

    return severityMap[type] || 'info';
  }

  /**
   * Check if severity is lower than expected
   */
  private isLowerSeverity(current: string, expected: string): boolean {
    const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(current);
    const expectedIndex = severityOrder.indexOf(expected);

    return currentIndex < expectedIndex;
  }
}
