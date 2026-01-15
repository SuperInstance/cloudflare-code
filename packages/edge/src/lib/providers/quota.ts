/**
 * Quota Tracking System
 *
 * Real-time quota tracking and management for all providers.
 * Supports daily/monthly resets, predictive capacity planning, and alerts.
 */

import type { ProviderClient, QuotaInfo } from './base';

/**
 * Quota configuration
 */
export interface QuotaConfig {
  /** KV namespace for persistent storage */
  kv?: KVNamespace;
  /** Alert thresholds (0-1) */
  warningThreshold: number;
  criticalThreshold: number;
  /** Enable predictive capacity planning */
  enablePrediction: boolean;
  /** Prediction window in hours */
  predictionWindow: number;
}

/**
 * Usage record for prediction
 */
interface UsageRecord {
  timestamp: number;
  amount: number;
  provider: string;
}

/**
 * Capacity prediction
 */
export interface CapacityPrediction {
  /** Provider name */
  provider: string;
  /** Current quota remaining */
  currentRemaining: number;
  /** Projected exhaustion timestamp (0 if never) */
  projectedExhaustion: number;
  /** Hours until exhaustion */
  hoursUntilExhaustion: number;
  /** Usage trend */
  trend: 'increasing' | 'stable' | 'decreasing';
  /** Average hourly usage */
  avgHourlyUsage: number;
  /** Recommendation */
  recommendation: string;
  /** Severity */
  severity: 'ok' | 'warning' | 'critical';
}

/**
 * Quota alert
 */
export interface QuotaAlert {
  /** Alert ID */
  id: string;
  /** Provider name */
  provider: string;
  /** Alert severity */
  severity: 'info' | 'warning' | 'critical';
  /** Alert message */
  message: string;
  /** Current quota percentage */
  quotaPercentage: number;
  /** Quota remaining */
  remaining: number;
  /** Timestamp */
  timestamp: number;
  /** Is acknowledged */
  acknowledged: boolean;
}

/**
 * Quota Tracker class
 */
export class QuotaTracker {
  private config: QuotaConfig;
  private quotas: Map<string, QuotaInfo> = new Map();
  private usageHistory: UsageRecord[] = [];
  private alerts: QuotaAlert[] = [];
  private maxHistorySize = 1000; // Keep last 1000 records

  constructor(config: QuotaConfig = {}) {
    this.config = {
      kv: config.kv,
      warningThreshold: config.warningThreshold ?? 0.8, // 80%
      criticalThreshold: config.criticalThreshold ?? 0.95, // 95%
      enablePrediction: config.enablePrediction ?? true,
      predictionWindow: config.predictionWindow ?? 24, // 24 hours
    };
  }

  /**
   * Initialize quota tracking for a provider
   */
  async initializeProvider(
    provider: ProviderClient,
    limit: number,
    resetType: 'daily' | 'monthly' | 'never'
  ): Promise<void> {
    const providerName = provider.name;
    const key = this.getStorageKey(providerName);

    // Try to load from KV
    if (this.config.kv) {
      try {
        const cached = await this.config.kv.get(key, 'json');
        if (cached && this.isValidQuotaInfo(cached)) {
          // Check if quota needs reset
          const now = Date.now();
          if (now > cached.resetTime) {
            // Reset quota
            const resetTime = this.calculateNextReset(resetType);
            const quota: QuotaInfo = {
              ...cached,
              used: 0,
              remaining: limit,
              resetTime,
              lastUpdated: now,
              isExhausted: false,
            };
            this.quotas.set(providerName, quota);
            await this.saveToStorage(providerName, quota);
          } else {
            // Use cached quota
            this.quotas.set(providerName, cached);
          }
          return;
        }
      } catch (error) {
        console.error(`Failed to load quota for ${providerName}:`, error);
      }
    }

    // Initialize new quota
    const resetTime = this.calculateNextReset(resetType);
    const quota: QuotaInfo = {
      provider: providerName,
      used: 0,
      limit,
      remaining: limit,
      resetTime,
      resetType,
      lastUpdated: Date.now(),
      isExhausted: false,
    };

    this.quotas.set(providerName, quota);
    await this.saveToStorage(providerName, quota);
  }

  /**
   * Track usage for a provider
   */
  async trackUsage(providerName: string, amount: number): Promise<void> {
    const quota = this.quotas.get(providerName);
    if (!quota) {
      throw new Error(`Provider '${providerName}' not initialized`);
    }

    // Check if quota needs reset
    const now = Date.now();
    if (now > quota.resetTime) {
      const resetTime = this.calculateNextReset(quota.resetType);
      quota.used = 0;
      quota.remaining = quota.limit;
      quota.resetTime = resetTime;
    }

    // Update usage
    quota.used += amount;
    quota.remaining = Math.max(0, quota.limit - quota.used);
    quota.lastUpdated = now;
    quota.isExhausted = quota.remaining < (quota.limit * 0.1); // 90% threshold

    // Record usage for prediction
    this.recordUsage(providerName, amount);

    // Check for alerts
    await this.checkAlerts(providerName, quota);

    // Save to storage
    await this.saveToStorage(providerName, quota);
  }

  /**
   * Get quota info for a provider
   */
  async getQuota(providerName: string): Promise<QuotaInfo | undefined> {
    const quota = this.quotas.get(providerName);
    if (!quota) return undefined;

    // Check if quota needs reset
    const now = Date.now();
    if (now > quota.resetTime) {
      const resetTime = this.calculateNextReset(quota.resetType);
      quota.used = 0;
      quota.remaining = quota.limit;
      quota.resetTime = resetTime;
      quota.lastUpdated = now;
      quota.isExhausted = false;
    }

    return quota;
  }

  /**
   * Get all quota info
   */
  async getAllQuotas(): Promise<Map<string, QuotaInfo>> {
    const quotas = new Map<string, QuotaInfo>();

    for (const [name, _quota] of this.quotas.entries()) {
      const updated = await this.getQuota(name);
      if (updated) {
        quotas.set(name, updated);
      }
    }

    return quotas;
  }

  /**
   * Get usage percentage for a provider
   */
  getUsagePercentage(providerName: string): number {
    const quota = this.quotas.get(providerName);
    if (!quota || quota.limit === 0) return 0;
    return (quota.used / quota.limit) * 100;
  }

  /**
   * Check if quota is exhausted
   */
  isExhausted(providerName: string, threshold: number = 0.9): boolean {
    const percentage = this.getUsagePercentage(providerName);
    return percentage >= (threshold * 100);
  }

  /**
   * Get capacity prediction for a provider
   */
  async getCapacityPrediction(providerName: string): Promise<CapacityPrediction> {
    const quota = this.quotas.get(providerName);
    if (!quota) {
      throw new Error(`Provider '${providerName}' not initialized`);
    }

    // Calculate average hourly usage
    const avgHourlyUsage = this.calculateAverageHourlyUsage(providerName);

    // Calculate hours until exhaustion
    let hoursUntilExhaustion = Infinity;
    let projectedExhaustion = 0;

    if (avgHourlyUsage > 0) {
      hoursUntilExhaustion = quota.remaining / avgHourlyUsage;
      projectedExhaustion = Date.now() + hoursUntilExhaustion * 60 * 60 * 1000;
    }

    // Detect trend
    const trend = this.detectTrend(providerName);

    // Generate recommendation and severity
    let recommendation = 'OK';
    let severity: 'ok' | 'warning' | 'critical' = 'ok';

    if (hoursUntilExhaustion < 6) {
      recommendation = `CRITICAL: ${providerName} will be exhausted in ${hoursUntilExhaustion.toFixed(1)} hours. Immediately stop routing to this provider.`;
      severity = 'critical';
    } else if (hoursUntilExhaustion < 24) {
      recommendation = `WARNING: ${providerName} will be exhausted in ${hoursUntilExhaustion.toFixed(1)} hours. Reduce routing to this provider.`;
      severity = 'warning';
    } else if (trend === 'increasing') {
      recommendation = `INFO: ${providerName} usage is increasing. Monitor closely.`;
      severity = 'warning';
    } else {
      recommendation = `OK: ${providerName} has sufficient capacity.`;
      severity = 'ok';
    }

    return {
      provider: providerName,
      currentRemaining: quota.remaining,
      projectedExhaustion,
      hoursUntilExhaustion,
      trend,
      avgHourlyUsage,
      recommendation,
      severity,
    };
  }

  /**
   * Get all capacity predictions
   */
  async getAllPredictions(): Promise<Map<string, CapacityPrediction>> {
    const predictions = new Map<string, CapacityPrediction>();

    for (const providerName of this.quotas.keys()) {
      try {
        const prediction = await this.getCapacityPrediction(providerName);
        predictions.set(providerName, prediction);
      } catch (error) {
        // Skip providers that fail prediction
        continue;
      }
    }

    return predictions;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): QuotaAlert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    totalProviders: number;
    totalUsage: number;
    totalLimit: number;
    avgUsagePercentage: number;
    exhaustedProviders: string[];
  } {
    let totalUsage = 0;
    let totalLimit = 0;
    const exhaustedProviders: string[] = [];

    for (const [name, quota] of this.quotas.entries()) {
      totalUsage += quota.used;
      totalLimit += quota.limit;
      if (quota.isExhausted) {
        exhaustedProviders.push(name);
      }
    }

    return {
      totalProviders: this.quotas.size,
      totalUsage,
      totalLimit,
      avgUsagePercentage: totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0,
      exhaustedProviders,
    };
  }

  /**
   * Record usage for prediction
   */
  private recordUsage(providerName: string, amount: number): void {
    this.usageHistory.push({
      timestamp: Date.now(),
      amount,
      provider: providerName,
    });

    // Keep history size bounded
    if (this.usageHistory.length > this.maxHistorySize) {
      this.usageHistory.shift();
    }
  }

  /**
   * Calculate average hourly usage for a provider
   */
  private calculateAverageHourlyUsage(providerName: string): number {
    const now = Date.now();
    const windowStart = now - this.config.predictionWindow * 60 * 60 * 1000;

    const providerUsage = this.usageHistory.filter(
      (r) => r.provider === providerName && r.timestamp > windowStart
    );

    if (providerUsage.length === 0) return 0;

    const total = providerUsage.reduce((sum, r) => sum + r.amount, 0);
    return total / this.config.predictionWindow;
  }

  /**
   * Detect usage trend
   */
  private detectTrend(providerName: string): 'increasing' | 'stable' | 'decreasing' {
    const now = Date.now();
    const windowStart = now - 24 * 60 * 60 * 1000; // Last 24 hours

    const providerUsage = this.usageHistory.filter(
      (r) => r.provider === providerName && r.timestamp > windowStart
    );

    if (providerUsage.length < 2) return 'stable';

    // Compare first half to second half
    const midPoint = now - 12 * 60 * 60 * 1000;
    const firstHalf = providerUsage.filter((r) => r.timestamp < midPoint);
    const secondHalf = providerUsage.filter((r) => r.timestamp >= midPoint);

    const firstTotal = firstHalf.reduce((sum, r) => sum + r.amount, 0);
    const secondTotal = secondHalf.reduce((sum, r) => sum + r.amount, 0);

    const change = (secondTotal - firstTotal) / (firstTotal || 1);

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Check for alerts based on quota usage
   */
  private async checkAlerts(providerName: string, quota: QuotaInfo): Promise<void> {
    const usagePercentage = quota.used / quota.limit;

    // Critical alert
    if (usagePercentage >= this.config.criticalThreshold) {
      const alert: QuotaAlert = {
        id: crypto.randomUUID(),
        provider: providerName,
        severity: 'critical',
        message: `CRITICAL: ${providerName} quota at ${(usagePercentage * 100).toFixed(1)}%. Only ${quota.remaining} remaining.`,
        quotaPercentage: usagePercentage * 100,
        remaining: quota.remaining,
        timestamp: Date.now(),
        acknowledged: false,
      };

      // Check if similar alert already exists
      const exists = this.alerts.some(
        (a) =>
          a.provider === providerName &&
          a.severity === 'critical' &&
          !a.acknowledged &&
          Date.now() - a.timestamp < 60 * 60 * 1000 // 1 hour
      );

      if (!exists) {
        this.alerts.push(alert);
        console.error(`[QUOTA ALERT] ${alert.message}`);
      }
    }
    // Warning alert
    else if (usagePercentage >= this.config.warningThreshold) {
      const alert: QuotaAlert = {
        id: crypto.randomUUID(),
        provider: providerName,
        severity: 'warning',
        message: `WARNING: ${providerName} quota at ${(usagePercentage * 100).toFixed(1)}%. ${quota.remaining} remaining.`,
        quotaPercentage: usagePercentage * 100,
        remaining: quota.remaining,
        timestamp: Date.now(),
        acknowledged: false,
      };

      // Check if similar alert already exists
      const exists = this.alerts.some(
        (a) =>
          a.provider === providerName &&
          a.severity === 'warning' &&
          !a.acknowledged &&
          Date.now() - a.timestamp < 2 * 60 * 60 * 1000 // 2 hours
      );

      if (!exists) {
        this.alerts.push(alert);
        console.warn(`[QUOTA ALERT] ${alert.message}`);
      }
    }
  }

  /**
   * Save quota to storage
   */
  private async saveToStorage(providerName: string, quota: QuotaInfo): Promise<void> {
    if (!this.config.kv) return;

    const key = this.getStorageKey(providerName);
    try {
      await this.config.kv.put(key, JSON.stringify(quota), {
        expirationTtl: 86400 * 7, // 7 days
      });
    } catch (error) {
      console.error(`Failed to save quota for ${providerName}:`, error);
    }
  }

  /**
   * Get storage key for provider
   */
  private getStorageKey(providerName: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `quota:${providerName}:${today}`;
  }

  /**
   * Validate quota info structure
   */
  private isValidQuotaInfo(data: unknown): data is QuotaInfo {
    if (!data || typeof data !== 'object') return false;
    const quota = data as Record<string, unknown>;
    return (
      typeof quota['provider'] === 'string' &&
      typeof quota['used'] === 'number' &&
      typeof quota['limit'] === 'number' &&
      typeof quota['remaining'] === 'number' &&
      typeof quota['resetTime'] === 'number'
    );
  }

  /**
   * Calculate next reset time
   */
  private calculateNextReset(resetType: 'daily' | 'monthly' | 'never'): number {
    const now = new Date();

    if (resetType === 'daily') {
      // Reset at midnight UTC
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return tomorrow.getTime();
    } else if (resetType === 'monthly') {
      // Reset at first of next month
      const nextMonth = new Date(now);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      nextMonth.setUTCDate(1);
      nextMonth.setUTCHours(0, 0, 0, 0);
      return nextMonth.getTime();
    } else {
      // Never reset
      return Number.MAX_SAFE_INTEGER;
    }
  }

  /**
   * Clear all quota data
   */
  clear(): void {
    this.quotas.clear();
    this.usageHistory = [];
    this.alerts = [];
  }
}

/**
 * Create quota tracker instance
 */
export function createQuotaTracker(config?: QuotaConfig): QuotaTracker {
  return new QuotaTracker(config);
}
