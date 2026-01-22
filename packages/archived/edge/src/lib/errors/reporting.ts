/**
 * Error Reporting and Analytics
 *
 * Comprehensive error reporting system with:
 * - Error aggregation and grouping
 * - Real-time error tracking
 * - Error pattern analysis
 * - Metrics collection
 * - Alert generation
 * - User-friendly error messages
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { ErrorType, ErrorCategory, ErrorSeverity, getErrorMetadata } from './types';

// ============================================================================
// ERROR REPORT
// ============================================================================

/**
 * Error report with full context
 */
export interface ErrorReport {
  /** Unique report ID */
  id: string;
  /** Error type */
  errorType: ErrorType;
  /** Error category */
  errorCategory: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** HTTP status code */
  statusCode?: number;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Provider that caused error */
  provider?: string;
  /** Model that caused error */
  model?: string;
  /** Request ID */
  requestId?: string;
  /** User ID */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
  /** Number of times this error occurred */
  occurrence: number;
  /** First occurrence timestamp */
  firstOccurrence?: number;
  /** Last occurrence timestamp */
  lastOccurrence?: number;
  /** Whether error was recovered */
  recovered: boolean;
  /** Recovery method */
  recoveryMethod?: string;
  /** Time to recovery (ms) */
  recoveryTime?: number;
  /** Related error IDs */
  relatedErrors?: string[];
}

// ============================================================================
// ERROR AGGREGATION
// ============================================================================

/**
 * Aggregated error statistics
 */
export interface ErrorAggregation {
  /** Error type */
  errorType: ErrorType;
  /** Error category */
  category: ErrorCategory;
  /** Total occurrences */
  totalOccurrences: number;
  /** Unique occurrences (different requests) */
  uniqueOccurrences: number;
  /** First occurrence timestamp */
  firstOccurrence: number;
  /** Last occurrence timestamp */
  lastOccurrence: number;
  /** Affected providers */
  affectedProviders: Set<string>;
  /** Affected models */
  affectedModels: Set<string>;
  /** Affected users */
  affectedUsers: Set<string>;
  /** Recovery rate (0-1) */
  recoveryRate: number;
  /** Average recovery time (ms) */
  avgRecoveryTime: number;
  /** Trend (increasing, decreasing, stable) */
  trend: 'increasing' | 'decreasing' | 'stable';
  /** Severity distribution */
  severityDistribution: Record<ErrorSeverity, number>;
}

// ============================================================================
// ERROR ANALYTICS
// ============================================================================

/**
 * Error analytics summary
 */
export interface ErrorAnalytics {
  /** Total errors in time window */
  totalErrors: number;
  /** Errors by type */
  errorsByType: Record<ErrorType, number>;
  /** Errors by category */
  errorsByCategory: Record<ErrorCategory, number>;
  /** Errors by severity */
  errorsBySeverity: Record<ErrorSeverity, number>;
  /** Errors by provider */
  errorsByProvider: Record<string, number>;
  /** Errors by model */
  errorsByModel: Record<string, number>;
  /** Top errors by occurrence */
  topErrors: Array<{
    errorType: ErrorType;
    count: number;
    percentage: number;
  }>;
  /** Recovery rate (0-1) */
  overallRecoveryRate: number;
  /** Average recovery time (ms) */
  avgRecoveryTime: number;
  /** Error trend */
  errorTrend: 'increasing' | 'decreasing' | 'stable';
  /** Time window for analytics */
  timeWindow: {
    start: number;
    end: number;
  };
}

// ============================================================================
// ERROR ALERT
// ============================================================================

/**
 * Error alert configuration
 */
export interface ErrorAlert {
  /** Alert ID */
  id: string;
  /** Alert type */
  type: 'threshold' | 'spike' | 'pattern' | 'critical';
  /** Error type to monitor */
  errorType?: ErrorType;
  /** Error category to monitor */
  errorCategory?: ErrorCategory;
  /** Error severity to monitor */
  errorSeverity?: ErrorSeverity;
  /** Threshold value */
  threshold?: number;
  /** Time window (ms) */
  timeWindow?: number;
  /** Alert condition */
  condition: 'greater_than' | 'less_than' | 'equals' | 'spike_detected';
  /** Whether alert is active */
  active: boolean;
  /** Alert triggered count */
  triggerCount: number;
  /** Last triggered timestamp */
  lastTriggered?: number;
  /** Notification channels */
  channels: string[];
  /** Cooldown period (ms) */
  cooldown: number;
}

// ============================================================================
// ERROR REPORTING CONFIGURATION
// ============================================================================

/**
 * Error reporting configuration
 */
export interface ErrorReportingConfig {
  /** KV namespace for persistence */
  kv?: KVNamespace;
  /** Key prefix for storage */
  keyPrefix: string;
  /** Enable error aggregation */
  enableAggregation: boolean;
  /** Enable real-time tracking */
  enableRealTime: boolean;
  /** Enable analytics */
  enableAnalytics: boolean;
  /** Enable alerts */
  enableAlerts: boolean;
  /** Time window for analytics (ms) */
  analyticsTimeWindow: number;
  /** Maximum reports to keep */
  maxReports: number;
  /** Enable user-friendly messages */
  enableUserMessages: boolean;
  /** Alert configurations */
  alerts: ErrorAlert[];
}

// ============================================================================
// ERROR REPORTER
// ============================================================================

/**
 * Main error reporting and analytics system
 */
export class ErrorReporter {
  private config: ErrorReportingConfig;
  private reports: Map<string, ErrorReport> = new Map();
  private aggregations: Map<ErrorType, ErrorAggregation> = new Map();
  private alerts: Map<string, ErrorAlert> = new Map();

  constructor(config: ErrorReportingConfig) {
    this.config = config;

    // Initialize alerts
    for (const alert of this.config.alerts) {
      this.alerts.set(alert.id, alert);
    }

    // Load data from KV if available
    if (this.config.kv) {
      this.loadFromKV().catch(console.error);
    }
  }

  /**
   * Report an error
   */
  async report(error: {
    errorType: ErrorType;
    message: string;
    stack?: string;
    statusCode?: number;
    provider?: string;
    model?: string;
    requestId?: string;
    userId?: string;
    sessionId?: string;
    context?: Record<string, unknown>;
  }): Promise<string> {
    const id = this.generateReportId();
    const now = Date.now();
    const metadata = getErrorMetadata(error.errorType);

    const report: ErrorReport = {
      id,
      errorType: error.errorType,
      errorCategory: metadata.category,
      severity: metadata.severity,
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      timestamp: now,
      provider: error.provider,
      model: error.model,
      requestId: error.requestId,
      userId: error.userId,
      sessionId: error.sessionId,
      context: error.context,
      occurrence: 1,
      firstOccurrence: now,
      lastOccurrence: now,
      recovered: false,
    };

    // Store report
    this.reports.set(id, report);

    // Update aggregation
    if (this.config.enableAggregation) {
      await this.updateAggregation(report);
    }

    // Check alerts
    if (this.config.enableAlerts) {
      await this.checkAlerts(report);
    }

    // Save to KV
    if (this.config.kv) {
      await this.saveToKV(id, report);
    }

    return id;
  }

  /**
   * Update error recovery information
   */
  async updateRecovery(
    reportId: string,
    recovered: boolean,
    recoveryMethod?: string,
    recoveryTime?: number
  ): Promise<void> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    report.recovered = recovered;
    report.recoveryMethod = recoveryMethod;
    report.recoveryTime = recoveryTime;

    // Save to KV
    if (this.config.kv) {
      await this.saveToKV(reportId, report);
    }
  }

  /**
   * Get error report by ID
   */
  getReport(id: string): ErrorReport | undefined {
    return this.reports.get(id);
  }

  /**
   * List error reports with filtering
   */
  listReports(filter?: {
    errorType?: ErrorType;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    provider?: string;
    model?: string;
    recovered?: boolean;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): ErrorReport[] {
    let reports = Array.from(this.reports.values());

    // Apply filters
    if (filter?.errorType) {
      reports = reports.filter(r => r.errorType === filter.errorType);
    }
    if (filter?.category) {
      reports = reports.filter(r => r.errorCategory === filter.category);
    }
    if (filter?.severity) {
      reports = reports.filter(r => r.severity === filter.severity);
    }
    if (filter?.provider) {
      reports = reports.filter(r => r.provider === filter.provider);
    }
    if (filter?.model) {
      reports = reports.filter(r => r.model === filter.model);
    }
    if (filter?.recovered !== undefined) {
      reports = reports.filter(r => r.recovered === filter.recovered);
    }
    if (filter?.startTime) {
      reports = reports.filter(r => r.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      reports = reports.filter(r => r.timestamp <= filter.endTime!);
    }

    // Sort by timestamp (newest first)
    reports.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (filter?.limit) {
      reports = reports.slice(0, filter.limit);
    }

    return reports;
  }

  /**
   * Get error analytics
   */
  async getAnalytics(timeWindow?: number): Promise<ErrorAnalytics> {
    const window = timeWindow ?? this.config.analyticsTimeWindow;
    const now = Date.now();
    const startTime = now - window;

    const reports = this.listReports({ startTime });

    const analytics: ErrorAnalytics = {
      totalErrors: reports.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByProvider: {} as Record<string, number>,
      errorsByModel: {} as Record<string, number>,
      topErrors: [],
      overallRecoveryRate: 0,
      avgRecoveryTime: 0,
      errorTrend: 'stable',
      timeWindow: {
        start: startTime,
        end: now,
      },
    };

    // Aggregate by various dimensions
    let totalRecoveryTime = 0;
    let recoveredCount = 0;

    for (const report of reports) {
      // By type
      analytics.errorsByType[report.errorType] =
        (analytics.errorsByType[report.errorType] || 0) + 1;

      // By category
      analytics.errorsByCategory[report.errorCategory] =
        (analytics.errorsByCategory[report.errorCategory] || 0) + 1;

      // By severity
      analytics.errorsBySeverity[report.severity] =
        (analytics.errorsBySeverity[report.severity] || 0) + 1;

      // By provider
      if (report.provider) {
        analytics.errorsByProvider[report.provider] =
          (analytics.errorsByProvider[report.provider] || 0) + 1;
      }

      // By model
      if (report.model) {
        analytics.errorsByModel[report.model] =
          (analytics.errorsByModel[report.model] || 0) + 1;
      }

      // Recovery stats
      if (report.recovered) {
        recoveredCount++;
        if (report.recoveryTime) {
          totalRecoveryTime += report.recoveryTime;
        }
      }
    }

    // Calculate top errors
    const errorEntries = Object.entries(analytics.errorsByType)
      .map(([type, count]) => ({
        errorType: type as ErrorType,
        count,
        percentage: (count / reports.length) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    analytics.topErrors = errorEntries;

    // Calculate recovery rate
    analytics.overallRecoveryRate = reports.length > 0 ? recoveredCount / reports.length : 0;
    analytics.avgRecoveryTime = recoveredCount > 0 ? totalRecoveryTime / recoveredCount : 0;

    // Calculate trend
    analytics.errorTrend = this.calculateTrend(reports);

    return analytics;
  }

  /**
   * Get error aggregation for a specific error type
   */
  getAggregation(errorType: ErrorType): ErrorAggregation | undefined {
    return this.aggregations.get(errorType);
  }

  /**
   * Get all aggregations
   */
  getAllAggregations(): ErrorAggregation[] {
    return Array.from(this.aggregations.values());
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(errorType: ErrorType, context?: Record<string, unknown>): string {
    const metadata = getErrorMetadata(errorType);
    let message = metadata.userMessage;

    // Add context-specific information
    if (context?.provider) {
      message = message.replace('service', `${context.provider} service`);
    }
    if (context?.retryAfter) {
      message += ` Please retry after ${Math.ceil(context.retryAfter as number / 1000)} seconds.`;
    }

    return message;
  }

  /**
   * Get suggested actions for an error
   */
  getSuggestedActions(errorType: ErrorType): string[] {
    const metadata = getErrorMetadata(errorType);
    return [...metadata.suggestedActions];
  }

  /**
   * Get error documentation links
   */
  getDocumentationLinks(errorType: ErrorType): string[] {
    const metadata = getErrorMetadata(errorType);
    return metadata.docsLinks ?? [];
  }

  /**
   * Update error aggregation
   */
  private async updateAggregation(report: ErrorReport): Promise<void> {
    let aggregation = this.aggregations.get(report.errorType);

    if (!aggregation) {
      aggregation = {
        errorType: report.errorType,
        category: report.errorCategory,
        totalOccurrences: 0,
        uniqueOccurrences: 0,
        firstOccurrence: report.timestamp,
        lastOccurrence: report.timestamp,
        affectedProviders: new Set(),
        affectedModels: new Set(),
        affectedUsers: new Set(),
        recoveryRate: 0,
        avgRecoveryTime: 0,
        trend: 'stable',
        severityDistribution: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      };
      this.aggregations.set(report.errorType, aggregation);
    }

    // Update aggregation
    aggregation.totalOccurrences++;
    aggregation.uniqueOccurrences++;
    aggregation.lastOccurrence = Math.max(aggregation.lastOccurrence, report.timestamp);

    if (report.provider) {
      aggregation.affectedProviders.add(report.provider);
    }
    if (report.model) {
      aggregation.affectedModels.add(report.model);
    }
    if (report.userId) {
      aggregation.affectedUsers.add(report.userId);
    }

    aggregation.severityDistribution[report.severity]++;

    // Update recovery stats
    const recoveredReports = Array.from(this.reports.values())
      .filter(r => r.errorType === report.errorType && r.recovered);

    if (recoveredReports.length > 0) {
      const totalRecoveryTime = recoveredReports.reduce((sum, r) => sum + (r.recoveryTime ?? 0), 0);
      aggregation.recoveryRate = recoveredReports.length / aggregation.totalOccurrences;
      aggregation.avgRecoveryTime = totalRecoveryTime / recoveredReports.length;
    }

    // Calculate trend
    const recentReports = Array.from(this.reports.values())
      .filter(r => r.errorType === report.errorType)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-10);

    if (recentReports.length >= 5) {
      const firstHalf = recentReports.slice(0, Math.floor(recentReports.length / 2));
      const secondHalf = recentReports.slice(Math.floor(recentReports.length / 2));

      const firstHalfTime = firstHalf[firstHalf.length - 1].timestamp - firstHalf[0].timestamp;
      const secondHalfTime = secondHalf[secondHalf.length - 1].timestamp - secondHalf[0].timestamp;

      if (secondHalfTime < firstHalfTime * 0.5) {
        aggregation.trend = 'increasing';
      } else if (secondHalfTime > firstHalfTime * 1.5) {
        aggregation.trend = 'decreasing';
      }
    }
  }

  /**
   * Check alerts for error report
   */
  private async checkAlerts(report: ErrorReport): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (!alert.active) continue;

      // Check if alert matches error
      if (alert.errorType && alert.errorType !== report.errorType) continue;
      if (alert.errorCategory && alert.errorCategory !== report.errorCategory) continue;
      if (alert.errorSeverity && alert.errorSeverity !== report.severity) continue;

      // Check alert condition
      const shouldTrigger = await this.evaluateAlert(alert, report);

      if (shouldTrigger) {
        await this.triggerAlert(alert, report);
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private async evaluateAlert(alert: ErrorAlert, report: ErrorReport): Promise<boolean> {
    const now = Date.now();

    // Check cooldown
    if (alert.lastTriggered && (now - alert.lastTriggered) < alert.cooldown) {
      return false;
    }

    switch (alert.condition) {
      case 'greater_than':
        if (alert.threshold) {
          const aggregation = this.aggregations.get(report.errorType);
          return aggregation !== undefined && aggregation.totalOccurrences > alert.threshold;
        }
        return false;

      case 'less_than':
        if (alert.threshold) {
          const aggregation = this.aggregations.get(report.errorType);
          return aggregation !== undefined && aggregation.totalOccurrences < alert.threshold;
        }
        return false;

      case 'equals':
        if (alert.threshold) {
          const aggregation = this.aggregations.get(report.errorType);
          return aggregation !== undefined && aggregation.totalOccurrences === alert.threshold;
        }
        return false;

      case 'spike_detected':
        return this.detectSpike(report.errorType);

      default:
        return false;
    }
  }

  /**
   * Detect error spike
   */
  private detectSpike(errorType: ErrorType): boolean {
    const aggregation = this.aggregations.get(errorType);
    if (!aggregation) return false;

    // Simple spike detection: more than 2x normal rate
    const now = Date.now();
    const recentWindow = 60000; // 1 minute
    const normalWindow = 300000; // 5 minutes

    const recentReports = Array.from(this.reports.values())
      .filter(r => r.errorType === errorType && r.timestamp > now - recentWindow);

    const normalReports = Array.from(this.reports.values())
      .filter(r => r.errorType === errorType && r.timestamp > now - normalWindow && r.timestamp <= now - recentWindow);

    const recentRate = recentReports.length / (recentWindow / 60000);
    const normalRate = normalReports.length / ((normalWindow - recentWindow) / 60000);

    return recentRate > normalRate * 2;
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(alert: ErrorAlert, report: ErrorReport): Promise<void> {
    alert.triggerCount++;
    alert.lastTriggered = Date.now();

    // Send notifications to configured channels
    for (const channel of alert.channels) {
      await this.sendAlertNotification(channel, alert, report);
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(
    channel: string,
    alert: ErrorAlert,
    report: ErrorReport
  ): Promise<void> {
    // Implementation depends on notification channel
    // Could be email, Slack, webhook, etc.
    console.log(`Alert notification to ${channel}:`, {
      alert: alert.id,
      errorType: report.errorType,
      message: report.message,
      severity: report.severity,
    });
  }

  /**
   * Calculate error trend
   */
  private calculateTrend(reports: ErrorReport[]): 'increasing' | 'decreasing' | 'stable' {
    if (reports.length < 10) {
      return 'stable';
    }

    const firstHalf = reports.slice(0, Math.floor(reports.length / 2));
    const secondHalf = reports.slice(Math.floor(reports.length / 2));

    const firstHalfRate = firstHalf.length;
    const secondHalfRate = secondHalf.length;

    if (secondHalfRate > firstHalfRate * 1.2) {
      return 'increasing';
    } else if (secondHalfRate < firstHalfRate * 0.8) {
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Generate report ID
   */
  private generateReportId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Save to KV
   */
  private async saveToKV(id: string, report: ErrorReport): Promise<void> {
    if (!this.config.kv) return;

    try {
      const key = `${this.config.keyPrefix}/reports/${id}`;
      await this.config.kv.put(key, JSON.stringify(report), {
        expirationTtl: 86400, // 24 hours
      });
    } catch (error) {
      console.error('Error saving to KV:', error);
    }
  }

  /**
   * Load from KV
   */
  private async loadFromKV(): Promise<void> {
    if (!this.config.kv) return;

    try {
      // Load reports
      const reportsList = await this.config.kv.list({
        prefix: `${this.config.keyPrefix}/reports/`,
      });

      for (const object of reportsList.objects) {
        const value = await this.config.kv.get(object.key, 'json');
        if (value && typeof value === 'object') {
          const report = value as ErrorReport;
          this.reports.set(report.id, report);
        }
      }
    } catch (error) {
      console.error('Error loading from KV:', error);
    }
  }

  /**
   * Clear all reports
   */
  clear(): void {
    this.reports.clear();
    this.aggregations.clear();
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create error reporter with default configuration
 */
export function createErrorReporter(
  config?: Partial<ErrorReportingConfig>
): ErrorReporter {
  const defaultConfig: ErrorReportingConfig = {
    keyPrefix: 'error-reporting',
    enableAggregation: true,
    enableRealTime: true,
    enableAnalytics: true,
    enableAlerts: true,
    analyticsTimeWindow: 3600000, // 1 hour
    maxReports: 10000,
    enableUserMessages: true,
    alerts: [],
  };

  return new ErrorReporter({
    ...defaultConfig,
    ...config,
  });
}

/**
 * Create error reporter for production
 */
export function createProductionErrorReporter(kv: KVNamespace): ErrorReporter {
  return createErrorReporter({
    kv,
    keyPrefix: 'error-reporting/prod',
    enableAggregation: true,
    enableRealTime: true,
    enableAnalytics: true,
    enableAlerts: true,
    analyticsTimeWindow: 3600000, // 1 hour
    maxReports: 50000,
    enableUserMessages: true,
    alerts: [
      {
        id: 'critical-errors',
        type: 'critical',
        errorSeverity: 'critical',
        condition: 'greater_than',
        threshold: 0,
        active: true,
        triggerCount: 0,
        channels: ['webhook'],
        cooldown: 300000, // 5 minutes
      },
      {
        id: 'high-error-rate',
        type: 'threshold',
        condition: 'greater_than',
        threshold: 100,
        timeWindow: 300000, // 5 minutes
        active: true,
        triggerCount: 0,
        channels: ['webhook', 'email'],
        cooldown: 600000, // 10 minutes
      },
    ],
  });
}
