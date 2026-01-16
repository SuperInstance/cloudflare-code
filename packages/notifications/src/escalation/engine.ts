// @ts-nocheck
/**
 * Escalation engine for alert escalation
 */

import type {
  Escalation,
  EscalationRule,
  EscalationPath,
  EscalationLevel,
  EscalationCondition,
  EscalationStatus,
  EscalationHistoryEntry,
  Alert,
  NotificationChannelType,
} from '../types';

export interface EscalationEngineConfig {
  checkIntervalMs?: number;
  maxConcurrentEscalations?: number;
  enableAutoEscalation?: boolean;
  notificationTimeoutMs?: number;
}

export interface EscalationContext {
  alert: Alert;
  rule: EscalationRule;
  path: EscalationPath;
  currentLevel: number;
  startedAt: Date;
}

/**
 * Escalation engine implementation
 */
export class EscalationEngine {
  private rules: Map<string, EscalationRule> = new Map();
  private paths: Map<string, EscalationPath> = new Map();
  private escalations: Map<string, Escalation> = new Map();
  private config: EscalationEngineConfig;
  private checkTimer?: ReturnType<typeof setInterval>;

  constructor(config: EscalationEngineConfig = {}) {
    this.config = {
      checkIntervalMs: 60000, // 1 minute
      maxConcurrentEscalations: 100,
      enableAutoEscalation: true,
      notificationTimeoutMs: 300000, // 5 minutes
      ...config,
    };

    // Start escalation check timer if auto-escalation is enabled
    if (this.config.enableAutoEscalation) {
      this.startCheckTimer();
    }
  }

  /**
   * Add an escalation rule
   */
  addRule(rule: EscalationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an escalation rule
   */
  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  /**
   * Get an escalation rule
   */
  getRule(ruleId: string): EscalationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all escalation rules
   */
  getAllRules(): EscalationRule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add an escalation path
   */
  addPath(path: EscalationPath): void {
    this.paths.set(path.id, path);
  }

  /**
   * Remove an escalation path
   */
  removePath(pathId: string): boolean {
    return this.paths.delete(pathId);
  }

  /**
   * Get an escalation path
   */
  getPath(pathId: string): EscalationPath | undefined {
    return this.paths.get(pathId);
  }

  /**
   * Get all escalation paths
   */
  getAllPaths(): EscalationPath[] {
    return Array.from(this.paths.values());
  }

  /**
   * Evaluate an alert for escalation
   */
  async evaluateAlert(alert: Alert): Promise<EscalationRule[]> {
    const matchingRules: EscalationRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      if (this.matchesConditions(alert, rule.conditions)) {
        matchingRules.push(rule);
      }
    }

    // Sort by priority
    return matchingRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if alert matches escalation conditions
   */
  private matchesConditions(alert: Alert, conditions: EscalationCondition[]): boolean {
    if (conditions.length === 0) {
      return true;
    }

    return conditions.every((condition) => this.matchesCondition(alert, condition));
  }

  /**
   * Check if alert matches a single condition
   */
  private matchesCondition(alert: Alert, condition: EscalationCondition): boolean {
    const alertValue = this.getAlertValue(alert, condition);

    switch (condition.operator) {
      case 'equals':
        return alertValue === condition.value;

      case 'gt':
        return typeof alertValue === 'number' && alertValue > Number(condition.value);

      case 'lt':
        return typeof alertValue === 'number' && alertValue < Number(condition.value);

      case 'contains':
        return typeof alertValue === 'string' && String(condition.value) in alertValue;

      case 'matches':
        if (typeof alertValue !== 'string' || typeof condition.value !== 'string') {
          return false;
        }
        try {
          const regex = new RegExp(condition.value);
          return regex.test(alertValue);
        } catch {
          return false;
        }

      case 'unacknowledged':
        if (condition.durationMinutes) {
          const cutoff = new Date(Date.now() - condition.durationMinutes * 60 * 1000);
          return alert.status !== 'acknowledged' && alert.createdAt < cutoff;
        }
        return alert.status !== 'acknowledged';

      default:
        return false;
    }
  }

  /**
   * Get alert value for condition
   */
  private getAlertValue(alert: Alert, condition: EscalationCondition): unknown {
    switch (condition.type) {
      case 'severity':
        return alert.severity;

      case 'status':
        return alert.status;

      case 'time':
        return alert.createdAt;

      case 'unacknowledged':
        return alert.status !== 'acknowledged';

      case 'custom':
        if (condition.field && alert.data) {
          return alert.data[condition.field];
        }
        return undefined;

      default:
        return undefined;
    }
  }

  /**
   * Start an escalation
   */
  async startEscalation(
    alertId: string,
    ruleId: string,
    notifyCallback?: (userId: string, channels: NotificationChannelType[]) => Promise<void>
  ): Promise<Escalation> {
    const rule = this.rules.get(ruleId);

    if (!rule) {
      throw new Error(`Escalation rule not found: ${ruleId}`);
    }

    const path = this.paths.get(rule.pathId);

    if (!path) {
      throw new Error(`Escalation path not found: ${rule.pathId}`);
    }

    // Check if escalation already exists
    const existing = this.escalations.get(alertId);
    if (existing) {
      return existing;
    }

    // Create escalation
    const escalation: Escalation = {
      id: this.generateEscalationId(),
      alertId,
      pathId: path.id,
      currentLevel: 0,
      status: 'pending',
      startedAt: new Date(),
      timeoutAt: new Date(Date.now() + path.timeoutMinutes * 60 * 1000),
      history: [],
      notifications: [],
    };

    this.escalations.set(alertId, escalation);

    // Start first level
    await this.escalateToNextLevel(escalation, notifyCallback);

    return escalation;
  }

  /**
   * Escalate to next level
   */
  private async escalateToNextLevel(
    escalation: Escalation,
    notifyCallback?: (userId: string, channels: NotificationChannelType[]) => Promise<void>
  ): Promise<void> {
    const path = this.paths.get(escalation.pathId);

    if (!path || escalation.currentLevel >= path.levels.length) {
      escalation.status = 'escalated';
      return;
    }

    const level = path.levels[escalation.currentLevel];

    // Add to history
    const historyEntry: EscalationHistoryEntry = {
      level: escalation.currentLevel,
      userId: level.userId,
      action: 'notified',
      timestamp: new Date(),
    };

    escalation.history.push(historyEntry);

    // Notify the user
    if (notifyCallback) {
      try {
        await Promise.race([
          notifyCallback(level.userId, level.channels),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Notification timeout')), this.config.notificationTimeoutMs)
          ),
        ]);

        escalation.notifications.push(`${level.userId}:${level.channels.join(',')}`);
      } catch (error) {
        console.error(`Failed to notify user ${level.userId}:`, error);
      }
    }

    // Set timeout for next escalation
    if (level.timeoutMinutes) {
      escalation.timeoutAt = new Date(Date.now() + level.timeoutMinutes * 60 * 1000);
    } else {
      escalation.timeoutAt = new Date(Date.now() + path.timeoutMinutes * 60 * 1000);
    }

    escalation.status = 'pending';
  }

  /**
   * Acknowledge an escalation
   */
  acknowledgeEscalation(
    alertId: string,
    userId: string,
    note?: string
  ): boolean {
    const escalation = this.escalations.get(alertId);

    if (!escalation) {
      return false;
    }

    // Add history entry
    const historyEntry: EscalationHistoryEntry = {
      level: escalation.currentLevel,
      userId,
      action: 'acknowledged',
      timestamp: new Date(),
      note,
    };

    escalation.history.push(historyEntry);
    escalation.status = 'resolved';

    return true;
  }

  /**
   * Check and process pending escalations
   */
  async checkEscalations(notifyCallback?: (userId: string, channels: NotificationChannelType[]) => Promise<void>): Promise<void> {
    const now = new Date();
    const toEscalate: Escalation[] = [];

    // Find escalations that need to be escalated
    for (const escalation of this.escalations.values()) {
      if (
        escalation.status === 'pending' &&
        escalation.timeoutAt <= now &&
        !this.isAcknowledged(escalation)
      ) {
        toEscalate.push(escalation);
      }
    }

    // Process escalations
    for (const escalation of toEscalate) {
      await this.processEscalation(escalation, notifyCallback);
    }
  }

  /**
   * Process an escalation
   */
  private async processEscalation(
    escalation: Escalation,
    notifyCallback?: (userId: string, channels: NotificationChannelType[]) => Promise<void>
  ): Promise<void> {
    const path = this.paths.get(escalation.pathId);

    if (!path) {
      return;
    }

    // Check if we've reached max escalations
    if (escalation.currentLevel >= path.levels.length - 1) {
      if (path.repeatEnabled) {
        // Check max escalations
        const escalationCount = escalation.history.filter(
          (h) => h.action === 'notified'
        ).length;

        if (escalationCount >= path.maxEscalations) {
          escalation.status = 'escalated';
          return;
        }

        // Reset to first level
        escalation.currentLevel = 0;
      } else {
        escalation.status = 'escalated';
        return;
      }
    }

    // Add timeout history entry
    const historyEntry: EscalationHistoryEntry = {
      level: escalation.currentLevel,
      userId: path.levels[escalation.currentLevel]?.userId || '',
      action: 'timeout',
      timestamp: new Date(),
    };

    escalation.history.push(historyEntry);

    // Move to next level
    escalation.currentLevel++;

    // Escalate to next level
    await this.escalateToNextLevel(escalation, notifyCallback);
  }

  /**
   * Check if escalation has been acknowledged
   */
  private isAcknowledged(escalation: Escalation): boolean {
    return escalation.history.some((h) => h.action === 'acknowledged');
  }

  /**
   * Cancel an escalation
   */
  cancelEscalation(alertId: string): boolean {
    const escalation = this.escalations.get(alertId);

    if (!escalation) {
      return false;
    }

    escalation.status = 'cancelled';
    return true;
  }

  /**
   * Get an escalation by alert ID
   */
  getEscalation(alertId: string): Escalation | undefined {
    return this.escalations.get(alertId);
  }

  /**
   * Get all active escalations
   */
  getActiveEscalations(): Escalation[] {
    return Array.from(this.escalations.values()).filter(
      (e) => e.status === 'pending' || e.status === 'escalating'
    );
  }

  /**
   * Start escalation check timer
   */
  private startCheckTimer(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      this.checkEscalations().catch((error) => {
        console.error('Error checking escalations:', error);
      });
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop escalation check timer
   */
  stopCheckTimer(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  /**
   * Clean up completed escalations
   */
  cleanup(olderThanMs: number = 86400000): void {
    const cutoff = new Date(Date.now() - olderThanMs);

    for (const [alertId, escalation] of this.escalations.entries()) {
      if (
        escalation.status === 'resolved' ||
        escalation.status === 'cancelled' ||
        escalation.startedAt < cutoff
      ) {
        this.escalations.delete(alertId);
      }
    }
  }

  /**
   * Generate unique escalation ID
   */
  private generateEscalationId(): string {
    return `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all escalations
   */
  clearEscalations(): void {
    this.escalations.clear();
  }

  /**
   * Clear all rules and paths
   */
  clear(): void {
    this.rules.clear();
    this.paths.clear();
    this.escalations.clear();
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRules: number;
    activeRules: number;
    totalPaths: number;
    totalEscalations: number;
    activeEscalations: number;
    averageEscalationTime: number;
  } {
    let activeEscalations = 0;
    let totalEscalationTime = 0;

    for (const escalation of this.escalations.values()) {
      if (escalation.status === 'pending' || escalation.status === 'escalating') {
        activeEscalations++;
      }

      if (escalation.status === 'resolved') {
        const resolvedEntry = escalation.history.find((h) => h.action === 'acknowledged');
        if (resolvedEntry) {
          totalEscalationTime += resolvedEntry.timestamp.getTime() - escalation.startedAt.getTime();
        }
      }
    }

    const resolvedEscalations = Array.from(this.escalations.values()).filter(
      (e) => e.status === 'resolved'
    ).length;

    return {
      totalRules: this.rules.size,
      activeRules: Array.from(this.rules.values()).filter((r) => r.enabled).length,
      totalPaths: this.paths.size,
      totalEscalations: this.escalations.size,
      activeEscalations,
      averageEscalationTime: resolvedEscalations > 0 ? totalEscalationTime / resolvedEscalations : 0,
    };
  }
}
