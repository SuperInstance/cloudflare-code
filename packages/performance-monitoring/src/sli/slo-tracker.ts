/**
 * SLO (Service Level Objective) Tracker
 * Manages SLOs, error budgets, burn rates, and compliance
 */

import { EventEmitter } from 'eventemitter3';
import { SLITracker } from './sli-tracker';
import { SLO, ErrorBudget, BurnRateCalculation, SLOHistoryEntry, SLIMetric } from '../types';

export class SLOTracker {
  private slos: Map<string, SLO>;
  private sliTracker: SLITracker;
  private eventEmitter: EventEmitter;
  private maxHistoryEntries: number;

  constructor(sliTracker?: SLITracker, maxHistoryEntries: number = 1000) {
    this.slos = new Map();
    this.sliTracker = sliTracker || new SLITracker();
    this.eventEmitter = new EventEmitter();
    this.maxHistoryEntries = maxHistoryEntries;
  }

  /**
   * Create a new SLO
   */
  createSLO(config: {
    name: string;
    description: string;
    target: number; // 0.0 to 1.0 (e.g., 0.99 for 99%)
    sliName: string;
    measurementWindow: number; // milliseconds
    timeWindow: {
      rolling: number; // milliseconds
      calendar?: string; // e.g., "monthly"
    };
  }): SLO {
    const sli = this.sliTracker.getSLI(config.sliName);
    if (!sli) {
      throw new Error(`SLI ${config.sliName} not found`);
    }

    const sloId = this.generateSLOId();

    // Calculate initial error budget
    const errorBudget = this.calculateInitialErrorBudget(config.target, config.timeWindow.rolling);

    const slo: SLO = {
      id: sloId,
      name: config.name,
      description: config.description,
      target: config.target,
      sli: { ...sli },
      measurementWindow: config.measurementWindow,
      timeWindow: config.timeWindow,
      errorBudget,
      status: 'compliant',
      history: [],
      metadata: {}
    };

    this.slos.set(sloId, slo);

    this.eventEmitter.emit('slo:created', { id: sloId, name: config.name });

    return slo;
  }

  /**
   * Update SLO status based on current SLI value
   */
  updateSLO(sloId: string): SLO {
    const slo = this.slos.get(sloId);
    if (!slo) {
      throw new Error(`SLO ${sloId} not found`);
    }

    // Get current SLI value
    const sli = this.sliTracker.getSLI(slo.sli.name);
    if (!sli) {
      throw new Error(`SLI ${slo.sli.name} not found`);
    }

    slo.sli = { ...sli };

    // Update error budget
    slo.errorBudget = this.calculateErrorBudget(slo);

    // Determine status
    const complianceRate = slo.sli.value;
    slo.status = this.determineStatus(complianceRate, slo.target);

    // Add to history
    this.addToHistory(slo, sli.value, slo.errorBudget.remaining);

    // Emit events based on status
    if (slo.status === 'violated') {
      this.eventEmitter.emit('slo:violated', { id: sloId, name: slo.name });
    } else if (slo.status === 'warning') {
      this.eventEmitter.emit('slo:warning', { id: sloId, name: slo.name });
    }

    this.eventEmitter.emit('slo:updated', { id: sloId, status: slo.status });

    return slo;
  }

  /**
   * Get an SLO
   */
  getSLO(sloId: string): SLO | undefined {
    return this.slos.get(sloId);
  }

  /**
   * Get SLO by name
   */
  getSLOByName(name: string): SLO | undefined {
    for (const slo of this.slos.values()) {
      if (slo.name === name) {
        return slo;
      }
    }
    return undefined;
  }

  /**
   * Get all SLOs
   */
  getAllSLOs(): SLO[] {
    return Array.from(this.slos.values());
  }

  /**
   * Calculate error budget
   */
  private calculateErrorBudget(slo: SLO): ErrorBudget {
    const now = Date.now();
    const windowStart = now - slo.timeWindow.rolling;

    // Get SLI history for the time window
    const sliHistory = this.sliTracker.getHistory(slo.sli.name);

    // Filter to window and calculate actual performance
    const windowMetrics = sliHistory.filter(
      m => m.timestamp >= windowStart && m.timestamp <= now
    );

    let actualPerformance: number;
    if (windowMetrics.length > 0) {
      const avgValue = windowMetrics.reduce((sum, m) => sum + m.value, 0) / windowMetrics.length;
      actualPerformance = avgValue;
    } else {
      actualPerformance = slo.sli.value;
    }

    // Calculate error budget
    const targetPerformance = slo.target;
    const allowableBadEvents = 1 - targetPerformance;
    const actualBadEvents = 1 - actualPerformance;

    const initialBudget = allowableBadEvents * slo.timeWindow.rolling;
    const burned = actualBadEvents * slo.timeWindow.rolling;
    const remaining = Math.max(0, initialBudget - burned);

    // Calculate burn rate
    const burnRate = this.calculateBurnRate(slo);

    return {
      target: targetPerformance,
      remaining,
      burned,
      initial: initialBudget,
      burnRate: burnRate.current,
      timeRemaining: this.calculateTimeRemaining(remaining, burnRate.current)
    };
  }

  /**
   * Calculate initial error budget
   */
  private calculateInitialErrorBudget(target: number, window: number): ErrorBudget {
    const allowableBadEvents = 1 - target;
    const initial = allowableBadEvents * window;

    return {
      target,
      remaining: initial,
      burned: 0,
      initial,
      burnRate: 0,
      timeRemaining: window
    };
  }

  /**
   * Calculate burn rate
   */
  calculateBurnRate(slo: SLO): BurnRateCalculation {
    const now = Date.now();

    // Calculate burn rates over different time windows
    const shortTermWindow = 5 * 60 * 1000; // 5 minutes
    const mediumTermWindow = 60 * 60 * 1000; // 1 hour
    const longTermWindow = 24 * 60 * 60 * 1000; // 24 hours

    const shortTermBurn = this.calculateBurnRateForWindow(slo, shortTermWindow);
    const mediumTermBurn = this.calculateBurnRateForWindow(slo, mediumTermWindow);
    const longTermBurn = this.calculateBurnRateForWindow(slo, longTermWindow);

    // Determine trend
    let trend: 'increasing' | 'stable' | 'decreasing';
    if (mediumTermBurn > shortTermBurn * 1.2) {
      trend = 'decreasing';
    } else if (mediumTermBurn < shortTermBurn * 0.8) {
      trend = 'increasing';
    } else {
      trend = 'stable';
    }

    return {
      current: shortTermBurn,
      shortTerm: shortTermBurn,
      mediumTerm: mediumTermBurn,
      longTerm: longTermBurn,
      trend
    };
  }

  /**
   * Calculate burn rate for a specific time window
   */
  private calculateBurnRateForWindow(slo: SLO, window: number): number {
    const now = Date.now();
    const windowStart = now - window;

    const sliHistory = this.sliTracker.getHistory(slo.sli.name);
    const windowMetrics = sliHistory.filter(
      m => m.timestamp >= windowStart && m.timestamp <= now
    );

    if (windowMetrics.length === 0) {
      return 0;
    }

    const avgValue = windowMetrics.reduce((sum, m) => sum + m.value, 0) / windowMetrics.length;
    const badEventsRate = 1 - avgValue;
    const allowableBadEventsRate = 1 - slo.target;

    return allowableBadEventsRate > 0 ? badEventsRate / allowableBadEventsRate : 0;
  }

  /**
   * Calculate time remaining until error budget is exhausted
   */
  private calculateTimeRemaining(remaining: number, burnRate: number): number {
    if (burnRate <= 0) {
      return Infinity;
    }

    return remaining / burnRate;
  }

  /**
   * Determine SLO status
   */
  private determineStatus(value: number, target: number): SLO['status'] {
    const threshold = target * 0.95; // 95% of target

    if (value >= target) {
      return 'compliant';
    } else if (value >= threshold) {
      return 'warning';
    } else {
      return 'violated';
    }
  }

  /**
   * Add entry to SLO history
   */
  private addToHistory(slo: SLO, sliValue: number, errorBudgetRemaining: number): void {
    const entry: SLOHistoryEntry = {
      timestamp: Date.now(),
      sliValue,
      sloTarget: slo.target,
      errorBudgetRemaining,
      status: slo.status
    };

    slo.history.push(entry);

    // Trim history if needed
    if (slo.history.length > this.maxHistoryEntries) {
      slo.history.shift();
    }
  }

  /**
   * Get SLO history
   */
  getSLOHistory(sloId: string, limit?: number): SLOHistoryEntry[] {
    const slo = this.slos.get(sloId);
    if (!slo) {
      throw new Error(`SLO ${sloId} not found`);
    }

    return limit ? slo.history.slice(-limit) : slo.history;
  }

  /**
   * Get SLO compliance report
   */
  getComplianceReport(sloId: string): {
    sloId: string;
    name: string;
    target: number;
    current: number;
    status: string;
    errorBudgetRemaining: number;
    errorBudgetPercentage: number;
    burnRate: number;
    trend: string;
    timeRemaining: number;
    recommendations: string[];
  } {
    const slo = this.slos.get(sloId);
    if (!slo) {
      throw new Error(`SLO ${sloId} not found`);
    }

    const burnRate = this.calculateBurnRate(slo);
    const errorBudgetPercentage = (slo.errorBudget.remaining / slo.errorBudget.initial) * 100;

    const recommendations: string[] = [];

    if (slo.status === 'violated') {
      recommendations.push('SLO is violated. Immediate action required.');
      recommendations.push('Review recent incidents and post-mortem reports.');
      recommendations.push('Consider increasing capacity or optimizing performance.');
    } else if (slo.status === 'warning') {
      recommendations.push('SLO is at risk. Monitor closely.');
      recommendations.push('Review recent performance trends.');
      if (burnRate.trend === 'increasing') {
        recommendations.push('Error budget burn rate is increasing rapidly.');
      }
    } else {
      recommendations.push('SLO is compliant. Continue monitoring.');
    }

    if (slo.errorBudget.timeRemaining < 24 * 60 * 60 * 1000) {
      recommendations.push('Error budget will be exhausted within 24 hours at current burn rate.');
    }

    return {
      sloId,
      name: slo.name,
      target: slo.target,
      current: slo.sli.value,
      status: slo.status,
      errorBudgetRemaining: slo.errorBudget.remaining,
      errorBudgetPercentage,
      burnRate: slo.errorBudget.burnRate,
      trend: burnRate.trend,
      timeRemaining: slo.errorBudget.timeRemaining,
      recommendations
    };
  }

  /**
   * Generate SLO summary report
   */
  generateSummaryReport(): {
    totalSLOs: number;
    compliant: number;
    warning: number;
    violated: number;
    slos: Array<{
      id: string;
      name: string;
      status: string;
      target: number;
      current: number;
      errorBudgetRemaining: number;
    }>;
  } {
    const slos = this.getAllSLOs();

    const compliant = slos.filter(s => s.status === 'compliant').length;
    const warning = slos.filter(s => s.status === 'warning').length;
    const violated = slos.filter(s => s.status === 'violated').length;

    return {
      totalSLOs: slos.length,
      compliant,
      warning,
      violated,
      slos: slos.map(slo => ({
        id: slo.id,
        name: slo.name,
        status: slo.status,
        target: slo.target,
        current: slo.sli.value,
        errorBudgetRemaining: slo.errorBudget.remaining
      }))
    };
  }

  /**
   * Delete an SLO
   */
  deleteSLO(sloId: string): boolean {
    const deleted = this.slos.delete(sloId);
    if (deleted) {
      this.eventEmitter.emit('slo:deleted', { id: sloId });
    }
    return deleted;
  }

  /**
   * Clear all SLOs
   */
  clear(): void {
    this.slos.clear();
    this.eventEmitter.emit('slos:cleared');
  }

  /**
   * Generate a unique SLO ID
   */
  private generateSLOId(): string {
    return `slo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}
