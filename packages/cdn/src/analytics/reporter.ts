/**
 * Analytics Reporter
 *
 * Generate reports from CDN analytics data.
 */

import type { ICDNAnalytics } from '../types/index.js';
import { CDNAnalytics } from './analytics.js';

export interface IReportConfig {
  format: 'json' | 'html' | 'pdf' | 'csv';
  includeCharts?: boolean;
  includeRecommendations?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export class AnalyticsReporter {
  private analytics: CDNAnalytics;

  constructor(analytics: CDNAnalytics) {
    this.analytics = analytics;
  }

  /**
   * Generate performance report
   */
  public generatePerformanceReport(config?: IReportConfig): string {
    const analytics = this.analytics.getAnalytics();
    const summary = this.analytics.getSummary();

    const report = {
      title: 'CDN Performance Report',
      generatedAt: new Date().toISOString(),
      period: summary.period,
      summary: {
        requests: {
          total: summary.requests.total,
          cached: summary.requests.cached,
          uncached: summary.requests.uncached,
          hitRate: `${summary.requests.hitRate.toFixed(2)}%`
        },
        bandwidth: {
          total: this.formatBytes(summary.bandwidth.total),
          cached: this.formatBytes(summary.bandwidth.cached),
          saved: this.formatBytes(summary.bandwidth.saved),
          savingsRate: `${summary.bandwidth.savingsRate.toFixed(2)}%`
        },
        performance: {
          avgResponseTime: `${summary.performance.avgResponseTime.toFixed(2)}ms`,
          errorRate: `${summary.performance.errorRate.toFixed(2)}%`
        }
      },
      popularContent: this.analytics.getPopularContent(10),
      geographicalDistribution: this.analytics.getGeographicalDistribution()
    };

    return config?.format === 'json'
      ? JSON.stringify(report, null, 2)
      : this.generateTextReport(report);
  }

  /**
   * Generate security report
   */
  public generateSecurityReport(config?: IReportConfig): string {
    const analytics = this.analytics.getAnalytics();
    const events = this.analytics.getEvents({ type: 'threat_detected', limit: 100 });

    const report = {
      title: 'CDN Security Report',
      generatedAt: new Date().toISOString(),
      summary: {
        threatsBlocked: analytics.security.threatsBlocked,
        rateLimitExceeded: analytics.security.rateLimitExceeded,
        suspiciousIPs: analytics.security.suspiciousIPs
      },
      recentThreats: events.map(e => ({
        timestamp: e.timestamp,
        type: e.data.type,
        source: e.data.source,
        target: e.data.target,
        blocked: e.data.blocked
      }))
    };

    return config?.format === 'json'
      ? JSON.stringify(report, null, 2)
      : this.generateTextReport(report);
  }

  /**
   * Generate cache report
   */
  public generateCacheReport(config?: IReportConfig): string {
    const summary = this.analytics.getSummary();
    const popular = this.analytics.getPopularContent(20);

    const report = {
      title: 'Cache Performance Report',
      generatedAt: new Date().toISOString(),
      period: summary.period,
      metrics: {
        hitRate: `${summary.requests.hitRate.toFixed(2)}%`,
        missRate: `${(100 - summary.requests.hitRate).toFixed(2)}%`,
        bandwidthSavings: this.formatBytes(summary.bandwidth.saved),
        savingsRate: `${summary.bandwidth.savingsRate.toFixed(2)}%`
      },
      topCachedContent: popular.slice(0, 10),
      recommendations: this.generateCacheRecommendations(summary)
    };

    return config?.format === 'json'
      ? JSON.stringify(report, null, 2)
      : this.generateTextReport(report);
  }

  /**
   * Generate text report
   */
  private generateTextReport(report: any): string {
    let text = `${report.title}\n`;
    text += `${'='.repeat(report.title.length)}\n\n`;
    text += `Generated: ${report.generatedAt}\n`;

    if (report.period) {
      text += `Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}\n`;
    }

    text += '\n';

    // Summary
    if (report.summary) {
      text += 'Summary\n-------\n';
      for (const [key, value] of Object.entries(report.summary)) {
        if (typeof value === 'object') {
          text += `${key}:\n`;
          for (const [k, v] of Object.entries(value as any)) {
            text += `  ${k}: ${v}\n`;
          }
        } else {
          text += `${key}: ${value}\n`;
        }
      }
      text += '\n';
    }

    // Popular content
    if (report.popularContent) {
      text += 'Top Content\n-----------\n';
      for (const item of report.popularContent.slice(0, 10)) {
        text += `${item.path}: ${item.requests} requests, ${this.formatBytes(item.bandwidth)}\n`;
      }
      text += '\n';
    }

    // Recommendations
    if (report.recommendations) {
      text += 'Recommendations\n---------------\n';
      for (const rec of report.recommendations) {
        text += `- ${rec}\n`;
      }
    }

    return text;
  }

  /**
   * Generate cache recommendations
   */
  private generateCacheRecommendations(summary: any): string[] {
    const recommendations: string[] = [];

    if (summary.requests.hitRate < 80) {
      recommendations.push('Cache hit rate is below 80%. Consider increasing TTL values or optimizing cache rules.');
    }

    if (summary.bandwidth.savingsRate < 50) {
      recommendations.push('Bandwidth savings are below 50%. Review cache policies for static assets.');
    }

    if (summary.performance.avgResponseTime > 500) {
      recommendations.push('Average response time is high. Consider enabling stale-while-revalidate.');
    }

    return recommendations;
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Export report to file
   */
  public async exportToFile(
    report: string,
    filePath: string,
    format: 'json' | 'txt' | 'csv' = 'txt'
  ): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filePath, report, 'utf-8');
  }
}

export default AnalyticsReporter;
