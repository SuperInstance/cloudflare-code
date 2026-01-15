/**
 * Error Analyzer Module
 * Analyzes errors for patterns, trends, and root causes
 */

import {
  ErrorEvent,
  ErrorGroup,
  ErrorFrequency,
  ErrorImpact,
  ErrorTrend,
  ErrorPattern,
  PatternType,
  RootCauseAnalysis,
  ErrorCategory,
  ErrorSeverity,
  ErrorStatistics
} from '../types';

// ============================================================================
// Error Frequency Analyzer
// ============================================================================

export class FrequencyAnalyzer {
  /**
   * Calculate error frequencies
   */
  static analyze(errors: ErrorEvent[]): ErrorFrequency[] {
    const frequencies = new Map<string, number>();
    let total = 0;

    for (const error of errors) {
      const key = error.type;
      frequencies.set(key, (frequencies.get(key) || 0) + 1);
      total++;
    }

    return Array.from(frequencies.entries())
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        trend: 'stable',
        changePercent: 0
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Compare frequencies between two time periods
   */
  static compareFrequencies(
    current: ErrorEvent[],
    previous: ErrorEvent[]
  ): ErrorFrequency[] {
    const currentFreq = this.analyze(current);
    const previousFreq = this.analyze(previous);

    const previousMap = new Map(
      previousFreq.map(f => [f.errorType, f])
    );

    return currentFreq.map(freq => {
      const prev = previousMap.get(freq.errorType);

      if (!prev) {
        return {
          ...freq,
          trend: 'increasing' as const,
          changePercent: 100
        };
      }

      const changePercent = prev.count > 0
        ? ((freq.count - prev.count) / prev.count) * 100
        : 100;

      let trend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(changePercent) < 10) {
        trend = 'stable';
      } else if (changePercent > 0) {
        trend = 'increasing';
      } else {
        trend = 'decreasing';
      }

      return {
        ...freq,
        trend,
        changePercent
      };
    });
  }
}

// ============================================================================
// Error Impact Analyzer
// ============================================================================

export class ImpactAnalyzer {
  /**
   * Calculate error impact
   */
  static analyze(errors: ErrorEvent[], totalSessions: number = 0): ErrorImpact {
    const uniqueErrors = new Set(errors.map(e => e.id)).size;
    const uniqueUsers = new Set(
      errors.filter(e => e.user?.id).map(e => e.user!.id!)
    ).size;

    const severityDistribution: Record<ErrorSeverity, number> = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.INFO]: 0
    };

    const categoryDistribution: Record<string, number> = {};

    for (const error of errors) {
      severityDistribution[error.severity]++;
      categoryDistribution[error.category] =
        (categoryDistribution[error.category] || 0) + 1;
    }

    const errorRate = totalSessions > 0
      ? (uniqueErrors / totalSessions) * 100
      : 0;

    return {
      affectedUsers: uniqueUsers,
      affectedSessions: uniqueErrors,
      totalErrors: errors.length,
      errorRate,
      severityDistribution,
      categoryDistribution: categoryDistribution as Record<ErrorCategory, number>
    };
  }

  /**
   * Calculate user impact score
   */
  static calculateUserImpactScore(errors: ErrorEvent[]): number {
    if (errors.length === 0) return 0;

    let score = 0;

    // Factor 1: Error count (normalized to 0-1)
    const errorCountScore = Math.min(errors.length / 100, 1);

    // Factor 2: Unique users affected
    const uniqueUsers = new Set(
      errors.filter(e => e.user?.id).map(e => e.user!.id!)
    ).size;
    const userImpactScore = Math.min(uniqueUsers / 10, 1);

    // Factor 3: Severity distribution
    const severityWeights: Record<ErrorSeverity, number> = {
      [ErrorSeverity.CRITICAL]: 1.0,
      [ErrorSeverity.HIGH]: 0.75,
      [ErrorSeverity.MEDIUM]: 0.5,
      [ErrorSeverity.LOW]: 0.25,
      [ErrorSeverity.INFO]: 0.1
    };

    const severityScore = errors.reduce((sum, e) =>
      sum + severityWeights[e.severity], 0
    ) / errors.length;

    // Combined score (weighted average)
    score = (
      errorCountScore * 0.3 +
      userImpactScore * 0.4 +
      severityScore * 0.3
    );

    return Math.round(score * 100) / 100;
  }
}

// ============================================================================
// Error Trend Analyzer
// ============================================================================

export class TrendAnalyzer {
  /**
   * Analyze error trends over time
   */
  static analyze(
    errors: ErrorEvent[],
    period: 'hour' | 'day' | 'week' = 'day'
  ): ErrorTrend[] {
    const grouped = this.groupByPeriod(errors, period);

    return Array.from(grouped.entries())
      .map(([timestamp, periodErrors]) => {
        const uniqueErrors = new Set(periodErrors.map(e => e.id)).size;
        const typeCounts = new Map<string, number>();

        for (const error of periodErrors) {
          typeCounts.set(
            error.type,
            (typeCounts.get(error.type) || 0) + 1
          );
        }

        const topErrors = Array.from(typeCounts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        return {
          period: this.formatPeriod(timestamp, period),
          timestamp,
          totalErrors: periodErrors.length,
          uniqueErrors,
          errorRate: 0, // Would need session data for accurate rate
          topErrors
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Group errors by time period
   */
  private static groupByPeriod(
    errors: ErrorEvent[],
    period: 'hour' | 'day' | 'week'
  ): Map<number, ErrorEvent[]> {
    const grouped = new Map<number, ErrorEvent[]>();

    for (const error of errors) {
      const timestamp = this.getPeriodTimestamp(error.timestamp, period);

      if (!grouped.has(timestamp)) {
        grouped.set(timestamp, []);
      }

      grouped.get(timestamp)!.push(error);
    }

    return grouped;
  }

  /**
   * Get period timestamp
   */
  private static getPeriodTimestamp(
    timestamp: number,
    period: 'hour' | 'day' | 'week'
  ): number {
    const date = new Date(timestamp);

    switch (period) {
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        const dayOfWeek = date.getDay();
        date.setDate(date.getDate() - dayOfWeek);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.getTime();
  }

  /**
   * Format period for display
   */
  private static formatPeriod(timestamp: number, period: 'hour' | 'day' | 'week'): string {
    const date = new Date(timestamp);

    switch (period) {
      case 'hour':
        return date.toISOString().substring(0, 13) + ':00';
      case 'day':
        return date.toISOString().substring(0, 10);
      case 'week':
        return `Week of ${date.toISOString().substring(0, 10)}`;
    }
  }

  /**
   * Detect anomalies in trends
   */
  static detectAnomalies(trends: ErrorTrend[]): Array<{
    timestamp: number;
    expected: number;
    actual: number;
    deviation: number;
  }> {
    if (trends.length < 3) return [];

    const anomalies: Array<{
      timestamp: number;
      expected: number;
      actual: number;
      deviation: number;
    }> = [];

    // Calculate moving average
    const windowSize = 3;

    for (let i = windowSize; i < trends.length; i++) {
      const window = trends.slice(i - windowSize, i);
      const average = window.reduce((sum, t) => sum + t.totalErrors, 0) / windowSize;
      const current = trends[i];

      // Calculate standard deviation
      const variance = window.reduce((sum, t) =>
        sum + Math.pow(t.totalErrors - average, 2), 0
      ) / windowSize;
      const stdDev = Math.sqrt(variance);

      // Check if current is an outlier (2+ std devs away)
      const deviation = Math.abs(current.totalErrors - average);

      if (stdDev > 0 && deviation > 2 * stdDev) {
        anomalies.push({
          timestamp: current.timestamp,
          expected: Math.round(average),
          actual: current.totalErrors,
          deviation: Math.round((deviation / average) * 100)
        });
      }
    }

    return anomalies;
  }
}

// ============================================================================
// Error Pattern Detector
// ============================================================================

export class PatternDetector {
  /**
   * Detect patterns in errors
   */
  static detect(errors: ErrorEvent[]): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];

    // Detect temporal patterns
    patterns.push(...this.detectTemporalPatterns(errors));

    // Detect sequential patterns
    patterns.push(...this.detectSequentialPatterns(errors));

    // Detect correlated patterns
    patterns.push(...this.detectCorrelatedPatterns(errors));

    // Detect cyclical patterns
    patterns.push(...this.detectCyclicalPatterns(errors));

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Detect temporal patterns (errors at specific times)
   */
  private static detectTemporalPatterns(errors: ErrorEvent[]): ErrorPattern[] {
    const hourCounts = new Map<number, number>();

    for (const error of errors) {
      const hour = new Date(error.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Find hours with significantly more errors
    const avgErrorsPerHour = errors.length / 24;
    const patterns: ErrorPattern[] = [];

    for (const [hour, count] of hourCounts.entries()) {
      if (count > avgErrorsPerHour * 2) {
        patterns.push({
          pattern: `Errors spike at ${hour}:00`,
          type: 'temporal',
          description: `Error rate is ${Math.round(count / avgErrorsPerHour * 100)}% higher than average at ${hour}:00`,
          confidence: Math.min(0.9, 0.5 + (count / errors.length)),
          occurrences: count,
          examples: errors.filter(e => new Date(e.timestamp).getHours() === hour).slice(0, 5)
        });
      }
    }

    return patterns;
  }

  /**
   * Detect sequential patterns (errors following each other)
   */
  private static detectSequentialPatterns(errors: ErrorEvent[]): ErrorPattern[] {
    if (errors.length < 10) return [];

    const sortedErrors = [...errors].sort((a, b) => a.timestamp - b.timestamp);
    const sequences = new Map<string, number>();

    // Look for error type sequences
    for (let i = 0; i < sortedErrors.length - 1; i++) {
      const current = sortedErrors[i].type;
      const next = sortedErrors[i + 1].type;

      // Only count if within 5 minutes
      if (sortedErrors[i + 1].timestamp - sortedErrors[i].timestamp < 300000) {
        const sequence = `${current} -> ${next}`;
        sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
      }
    }

    const patterns: ErrorPattern[] = [];

    for (const [sequence, count] of sequences.entries()) {
      if (count >= 5) {
        patterns.push({
          pattern: sequence,
          type: 'sequential',
          description: `Error sequence "${sequence}" occurs ${count} times`,
          confidence: Math.min(0.95, 0.5 + (count / 50)),
          occurrences: count,
          examples: sortedErrors.slice(0, 5)
        });
      }
    }

    return patterns;
  }

  /**
   * Detect correlated patterns (errors with similar context)
   */
  private static detectCorrelatedPatterns(errors: ErrorEvent[]): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];

    // Check URL correlation
    const urlErrors = new Map<string, ErrorEvent[]>();
    for (const error of errors) {
      if (error.context.url) {
        const url = new URL(error.context.url).pathname;
        if (!urlErrors.has(url)) {
          urlErrors.set(url, []);
        }
        urlErrors.get(url)!.push(error);
      }
    }

    for (const [url, urlErrorList] of urlErrors.entries()) {
      if (urlErrorList.length >= 10) {
        patterns.push({
          pattern: `Errors on ${url}`,
          type: 'correlated',
          description: `${urlErrorList.length} errors occur on URL path ${url}`,
          confidence: Math.min(0.9, 0.5 + (urlErrorList.length / 100)),
          occurrences: urlErrorList.length,
          examples: urlErrorList.slice(0, 5)
        });
      }
    }

    return patterns;
  }

  /**
   * Detect cyclical patterns (errors that repeat)
   */
  private static detectCyclicalPatterns(errors: ErrorEvent[]): ErrorPattern[] {
    const patterns: ErrorPattern[] = [];

    // Group by error type and check for regular intervals
    const typeGroups = new Map<string, ErrorEvent[]>();
    for (const error of errors) {
      if (!typeGroups.has(error.type)) {
        typeGroups.set(error.type, []);
      }
      typeGroups.get(error.type)!.push(error);
    }

    for (const [type, typeErrors] of typeGroups.entries()) {
      if (typeErrors.length < 5) continue;

      const sorted = [...typeErrors].sort((a, b) => a.timestamp - b.timestamp);
      const intervals: number[] = [];

      for (let i = 1; i < sorted.length; i++) {
        intervals.push(sorted[i].timestamp - sorted[i - 1].timestamp);
      }

      // Check if intervals are consistent
      if (intervals.length > 0) {
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, i) =>
          sum + Math.pow(i - avgInterval, 2), 0
        ) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / avgInterval; // Coefficient of variation

        // If CV < 0.5, intervals are fairly consistent
        if (cv < 0.5 && avgInterval > 0) {
          const periodMinutes = Math.round(avgInterval / 60000);

          patterns.push({
            pattern: `Cyclical ${type} errors`,
            type: 'cyclical',
            description: `${type} errors occur approximately every ${periodMinutes} minutes`,
            confidence: Math.min(0.95, 0.6 + (1 - cv)),
            occurrences: sorted.length,
            examples: sorted.slice(0, 5)
          });
        }
      }
    }

    return patterns;
  }
}

// ============================================================================
// Root Cause Analyzer
// ============================================================================

export class RootCauseAnalyzer {
  /**
   * Perform root cause analysis
   */
  static analyze(error: ErrorEvent, group?: ErrorGroup): RootCauseAnalysis {
    const evidence: string[] = [];
    const contributingFactors: string[] = [];
    const suggestedActions: string[] = [];
    const relatedErrors: string[] = [];

    // Analyze stack trace
    if (error.stackFrames && error.stackFrames.length > 0) {
      const topFrame = error.stackFrames[0];

      if (topFrame.filename?.includes('node_modules')) {
        evidence.push(`Error originates from dependency: ${topFrame.filename}`);
        contributingFactors.push('Third-party library issue');
        suggestedActions.push('Review dependency version for known issues');
        suggestedActions.push('Consider updating or replacing the library');
      } else {
        evidence.push(`Error in application code: ${topFrame.filename}:${topFrame.lineNumber}`);
      }

      // Check for common patterns
      const stackTrace = error.stack || '';
      if (stackTrace.includes('async')) {
        contributingFactors.push('Asynchronous operation issue');
        suggestedActions.push('Review async/await error handling');
        suggestedActions.push('Ensure proper error propagation in promises');
      }
    }

    // Analyze category
    switch (error.category) {
      case ErrorCategory.NETWORK:
        evidence.push('Network-related error detected');
        contributingFactors.push('Network connectivity or API availability');
        suggestedActions.push('Check network connectivity and API status');
        suggestedActions.push('Implement retry logic with exponential backoff');
        suggestedActions.push('Add timeout handling');
        break;

      case ErrorCategory.DATABASE:
        evidence.push('Database-related error detected');
        contributingFactors.push('Database connectivity or query issue');
        suggestedActions.push('Review database connection pool settings');
        suggestedActions.push('Check query performance and add indexes if needed');
        suggestedActions.push('Implement query timeout handling');
        break;

      case ErrorCategory.VALIDATION:
        evidence.push('Input validation error detected');
        contributingFactors.push('Invalid user input or API contract violation');
        suggestedActions.push('Review and strengthen input validation');
        suggestedActions.push('Update API documentation');
        suggestedActions.push('Add client-side validation');
        break;

      case ErrorCategory.AUTHENTICATION:
        evidence.push('Authentication error detected');
        contributingFactors.push('Invalid credentials or token issue');
        suggestedActions.push('Review authentication flow');
        suggestedActions.push('Check token expiration and refresh logic');
        break;

      case ErrorCategory.MEMORY:
        evidence.push('Memory-related error detected');
        contributingFactors.push('Memory leak or excessive memory usage');
        suggestedActions.push('Profile application for memory leaks');
        suggestedActions.push('Review data caching strategies');
        suggestedActions.push('Implement memory monitoring and limits');
        break;
    }

    // Analyze breadcrumbs for context
    const httpBreadcrumbs = error.breadcrumbs.filter(b => b.type === 'http');
    if (httpBreadcrumbs.length > 0) {
      const failedRequests = httpBreadcrumbs.filter(b =>
        b.data?.statusCode && b.data.statusCode >= 400
      );

      if (failedRequests.length > 0) {
        evidence.push(`Previous HTTP failures detected: ${failedRequests.length}`);
        contributingFactors.push('Cascading failures from upstream services');
        suggestedActions.push('Implement circuit breaker pattern');
        suggestedActions.push('Add graceful degradation');
      }
    }

    // Analyze related errors in group
    if (group && group.errors.length > 1) {
      relatedErrors.push(...group.errors.slice(0, 5).map(e => e.id));

      // Check if errors are concentrated in specific environment
      const envCounts = new Map<string, number>();
      for (const e of group.errors) {
        envCounts.set(e.environment, (envCounts.get(e.environment) || 0) + 1);
      }

      const topEnv = Array.from(envCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];

      if (topEnv && topEnv[0] !== error.environment) {
        evidence.push(`Error also occurs in ${topEnv[0]} environment (${topEnv[1]} times)`);
      }
    }

    // Calculate confidence based on evidence
    const confidence = Math.min(0.95, 0.5 + (evidence.length * 0.1));

    // Generate root cause summary
    const rootCause = this.generateRootCauseSummary(
      error,
      contributingFactors,
      evidence
    );

    return {
      errorId: error.id,
      rootCause,
      confidence,
      evidence,
      contributingFactors,
      suggestedActions,
      relatedErrors,
      analysisDepth: evidence.length > 3 ? 'deep' : evidence.length > 1 ? 'medium' : 'shallow'
    };
  }

  /**
   * Generate root cause summary
   */
  private static generateRootCauseSummary(
    error: ErrorEvent,
    factors: string[],
    evidence: string[]
  ): string {
    if (factors.length === 0) {
      return `Unknown cause for ${error.type}: ${error.message}`;
    }

    const primaryFactor = factors[0];
    const secondaryFactors = factors.slice(1);

    let summary = `${primaryFactor} causing ${error.type}`;

    if (secondaryFactors.length > 0) {
      summary += `, potentially exacerbated by ${secondaryFactors.join(', ')}`;
    }

    return summary;
  }

  /**
   * Batch analyze multiple errors
   */
  static batchAnalyze(
    errors: ErrorEvent[],
    groups?: Map<string, ErrorGroup>
  ): Map<string, RootCauseAnalysis> {
    const analyses = new Map<string, RootCauseAnalysis>();

    for (const error of errors) {
      const group = error.groupId ? groups?.get(error.groupId) : undefined;
      const analysis = this.analyze(error, group);
      analyses.set(error.id, analysis);
    }

    return analyses;
  }
}

// ============================================================================
// Statistics Calculator
// ============================================================================

export class StatisticsCalculator {
  /**
   * Calculate overall error statistics
   */
  static calculate(errors: ErrorEvent[], groups?: ErrorGroup[]): ErrorStatistics {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    const oneWeekAgo = now - 604800000;

    const recentErrors = errors.filter(e => e.timestamp >= oneDayAgo);
    const uniqueErrors = new Set(errors.map(e => e.id)).size;

    const typeCounts = new Map<string, number>();
    const severityDistribution: Record<ErrorSeverity, number> = {
      [ErrorSeverity.CRITICAL]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.INFO]: 0
    };
    const categoryDistribution: Record<string, number> = {};
    const statusDistribution: Record<string, number> = {};

    for (const error of errors) {
      typeCounts.set(error.type, (typeCounts.get(error.type) || 0) + 1);
      severityDistribution[error.severity]++;
      categoryDistribution[error.category] =
        (categoryDistribution[error.category] || 0) + 1;
    }

    if (groups) {
      for (const group of groups) {
        statusDistribution[group.status] =
          (statusDistribution[group.status] || 0) + 1;
      }
    }

    // Calculate time series (last 24 hours, hourly)
    const timeSeries: Array<{ timestamp: number; count: number }> = [];
    for (let i = 24; i >= 0; i--) {
      const hourStart = now - (i * 3600000);
      const hourEnd = hourStart + 3600000;
      const count = errors.filter(e =>
        e.timestamp >= hourStart && e.timestamp < hourEnd
      ).length;

      timeSeries.push({
        timestamp: hourStart,
        count
      });
    }

    // Calculate error rate (errors per minute over last hour)
    const lastHourErrors = errors.filter(e => e.timestamp >= oneHourAgo);
    const errorRate = lastHourErrors.length / 60;

    const topErrorTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: errors.length,
      uniqueErrors,
      totalGroups: groups?.length || 0,
      errorRate,
      averageResolutionTime: 0, // Would need historical data
      topErrorTypes,
      severityDistribution,
      categoryDistribution: categoryDistribution as Record<ErrorCategory, number>,
      statusDistribution: statusDistribution as Record<string, number>,
      timeSeries
    };
  }
}

// ============================================================================
// Main Error Analyzer
// ============================================================================

export class ErrorAnalyzer {
  /**
   * Perform comprehensive analysis
   */
  static analyze(errors: ErrorEvent[], groups?: ErrorGroup[]) {
    return {
      frequencies: FrequencyAnalyzer.analyze(errors),
      impact: ImpactAnalyzer.analyze(errors),
      trends: TrendAnalyzer.analyze(errors),
      patterns: PatternDetector.detect(errors),
      statistics: StatisticsCalculator.calculate(errors, groups)
    };
  }

  /**
   * Generate analysis report
   */
  static generateReport(errors: ErrorEvent[], groups?: ErrorGroup[]): string {
    const analysis = this.analyze(errors, groups);

    let report = '# Error Analysis Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Statistics
    report += '## Overview\n\n';
    report += `- Total Errors: ${analysis.statistics.totalErrors}\n`;
    report += `- Unique Errors: ${analysis.statistics.uniqueErrors}\n`;
    report += `- Error Rate: ${analysis.statistics.errorRate.toFixed(2)} errors/min\n`;
    report += `- Total Groups: ${analysis.statistics.totalGroups}\n\n`;

    // Top Error Types
    report += '## Top Error Types\n\n';
    for (const item of analysis.statistics.topErrorTypes.slice(0, 5)) {
      report += `${item.count}x ${item.type}\n`;
    }
    report += '\n';

    // Severity Distribution
    report += '## Severity Distribution\n\n';
    for (const [severity, count] of Object.entries(analysis.statistics.severityDistribution)) {
      report += `- ${severity}: ${count}\n`;
    }
    report += '\n';

    // Category Distribution
    report += '## Category Distribution\n\n';
    for (const [category, count] of Object.entries(analysis.statistics.categoryDistribution)) {
      report += `- ${category}: ${count}\n`;
    }
    report += '\n';

    // Patterns
    if (analysis.patterns.length > 0) {
      report += '## Detected Patterns\n\n';
      for (const pattern of analysis.patterns.slice(0, 5)) {
        report += `### ${pattern.pattern}\n`;
        report += `- Type: ${pattern.type}\n`;
        report += `- Confidence: ${(pattern.confidence * 100).toFixed(0)}%\n`;
        report += `- Occurrences: ${pattern.occurrences}\n`;
        report += `- Description: ${pattern.description}\n\n`;
      }
    }

    return report;
  }
}
