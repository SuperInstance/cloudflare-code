/**
 * Performance Report Generator
 *
 * Generates comprehensive performance reports
 */

import type {
  PerformanceReport,
  PerformanceReportSummary,
  BenchmarkResult,
  LoadTestResult,
  OptimizationRecommendation,
  RegressionResult,
} from '../types/index.js';

export class ReportGenerator {
  /**
   * Generate a comprehensive performance report
   */
  generateReport(data: {
    benchmarks?: BenchmarkResult[];
    loadTests?: LoadTestResult[];
    recommendations?: OptimizationRecommendation[];
    regressions?: RegressionResult[];
    metadata?: Record<string, any>;
  }): PerformanceReport {
    const summary = this.generateSummary(data);

    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: this.determineReportType(data),
      summary,
      details: data,
      metadata: data.metadata || {},
    };
  }

  /**
   * Generate summary
   */
  private generateSummary(data: any): PerformanceReportSummary {
    const summary: PerformanceReportSummary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
      overallScore: 0,
      criticalIssues: 0,
      recommendations: 0,
    };

    // Count benchmarks
    if (data.benchmarks) {
      summary.totalTests += data.benchmarks.length;
    }

    // Count load tests
    if (data.loadTests) {
      summary.totalTests += data.loadTests.length;
      for (const test of data.loadTests) {
        if (test.requests.failed > 0) {
          summary.failed++;
        } else {
          summary.passed++;
        }
      }
    }

    // Count recommendations
    if (data.recommendations) {
      summary.recommendations = data.recommendations.length;
      summary.warnings = data.recommendations.filter((r: OptimizationRecommendation) =>
        r.severity === 'medium' || r.severity === 'low'
      ).length;
      summary.criticalIssues = data.recommendations.filter((r: OptimizationRecommendation) =>
        r.severity === 'critical' || r.severity === 'high'
      ).length;
    }

    // Count regressions
    if (data.regressions) {
      for (const regression of data.regressions) {
        if (regression.detected) {
          summary.failed++;
          summary.criticalIssues += regression.regressions.filter(
            r => r.severity === 'critical' || r.severity === 'high'
          ).length;
        }
      }
    }

    // Calculate overall score
    summary.overallScore = this.calculateScore(summary);

    return summary;
  }

  /**
   * Determine report type
   */
  private determineReportType(data: any): 'benchmark' | 'load-test' | 'profile' | 'regression' {
    if (data.regressions) return 'regression';
    if (data.loadTests) return 'load-test';
    if (data.benchmarks) return 'benchmark';
    return 'profile';
  }

  /**
   * Calculate overall score
   */
  private calculateScore(summary: PerformanceReportSummary): number {
    let score = 100;

    // Deduct for failures
    if (summary.totalTests > 0) {
      const failureRate = summary.failed / summary.totalTests;
      score -= failureRate * 50;
    }

    // Deduct for critical issues
    score -= summary.criticalIssues * 10;

    // Deduct for warnings
    score -= summary.warnings * 2;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Export report to JSON
   */
  exportJSON(report: PerformanceReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report to Markdown
   */
  exportMarkdown(report: PerformanceReport): string {
    let markdown = '# Performance Report\n\n';
    markdown += `**ID:** ${report.id}\n`;
    markdown += `**Generated:** ${new Date(report.timestamp).toISOString()}\n`;
    markdown += `**Type:** ${report.type}\n\n`;

    // Summary
    markdown += '## Summary\n\n';
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${report.summary.totalTests} |\n`;
    markdown += `| Passed | ${report.summary.passed} |\n`;
    markdown += `| Failed | ${report.summary.failed} |\n`;
    markdown += `| Warnings | ${report.summary.warnings} |\n`;
    markdown += `| Critical Issues | ${report.summary.criticalIssues} |\n`;
    markdown += `| Recommendations | ${report.summary.recommendations} |\n`;
    markdown += `| Overall Score | ${report.summary.overallScore}/100 |\n\n`;

    // Score badge
    const scoreColor = this.getScoreColor(report.summary.overallScore);
    markdown += `![Score](https://img.shields.io/badge/Performance-${report.summary.overallScore}-${scoreColor})\n\n`;

    // Benchmarks
    if (report.details.benchmarks && report.details.benchmarks.length > 0) {
      markdown += '## Benchmarks\n\n';
      markdown += '| Benchmark | Time (ms) | Ops/sec | Status |\n';
      markdown += '|-----------|-----------|---------|--------|\n';

      for (const bench of report.details.benchmarks) {
        const status = bench.avgTime < 100 ? '✅' : '⚠️';
        markdown += `| ${bench.name} | ${bench.avgTime.toFixed(4)} | ${bench.opsPerSecond.toFixed(0)} | ${status} |\n`;
      }
      markdown += '\n';
    }

    // Load Tests
    if (report.details.loadTests && report.details.loadTests.length > 0) {
      markdown += '## Load Tests\n\n';

      for (const test of report.details.loadTests) {
        markdown += `### ${test.name}\n\n`;
        markdown += `- **Throughput:** ${test.throughput.mean.toFixed(2)} req/s\n`;
        markdown += `- **Latency:** ${test.latency.mean.toFixed(2)}ms (p95: ${test.latency.percentile95.toFixed(2)}ms)\n`;
        markdown += `- **Errors:** ${test.requests.failed}/${test.requests.total} (${((test.requests.failed / test.requests.total) * 100).toFixed(2)}%)\n\n`;
      }
    }

    // Recommendations
    if (report.details.recommendations && report.details.recommendations.length > 0) {
      markdown += '## Recommendations\n\n';

      for (const rec of report.details.recommendations) {
        const emoji = this.getSeverityEmoji(rec.severity);
        markdown += `### ${emoji} ${rec.title}\n\n`;
        markdown += `**Severity:** ${rec.severity}\n`;
        markdown += `**Category:** ${rec.category}\n\n`;
        markdown += `${rec.description}\n\n`;
      }
    }

    // Regressions
    if (report.details.regressions && report.details.regressions.length > 0) {
      markdown += '## Regressions\n\n';

      for (const reg of report.details.regressions) {
        if (reg.detected) {
          markdown += `⚠️ **Regressions Detected:** ${reg.regressions.length}\n`;
        } else {
          markdown += `✅ No regressions detected\n`;
        }
        markdown += '\n';
      }
    }

    return markdown;
  }

  /**
   * Export report to HTML
   */
  exportHTML(report: PerformanceReport): string {
    const score = report.summary.overallScore;
    const scoreColor = this.getScoreColor(score);

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Performance Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; margin-bottom: 20px; }
    .score { font-size: 48px; font-weight: bold; color: ${scoreColor === 'green' ? '#22c55e' : scoreColor === 'yellow' ? '#eab308' : '#ef4444'}; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric { background: #f9fafb; padding: 20px; border-radius: 8px; }
    .metric-label { font-size: 14px; color: #6b7280; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .section { margin: 40px 0; }
    .section-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e0e0e0; }
    th { background: #f9fafb; font-weight: 600; }
    .status-pass { color: #22c55e; }
    .status-fail { color: #ef4444; }
    .status-warn { color: #eab308; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Performance Report</h1>
    <p>Generated: ${new Date(report.timestamp).toISOString()}</p>
    <p>Type: ${report.type}</p>
  </div>

  <div class="summary">
    <div class="metric">
      <div class="metric-label">Overall Score</div>
      <div class="score">${score}/100</div>
    </div>
    <div class="metric">
      <div class="metric-label">Total Tests</div>
      <div class="metric-value">${report.summary.totalTests}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Passed</div>
      <div class="metric-value status-pass">${report.summary.passed}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Failed</div>
      <div class="metric-value ${report.summary.failed > 0 ? 'status-fail' : ''}">${report.summary.failed}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Critical Issues</div>
      <div class="metric-value ${report.summary.criticalIssues > 0 ? 'status-fail' : ''}">${report.summary.criticalIssues}</div>
    </div>
  </div>
`;

    // Benchmarks table
    if (report.details.benchmarks && report.details.benchmarks.length > 0) {
      html += `
  <div class="section">
    <div class="section-title">Benchmarks</div>
    <table>
      <thead>
        <tr>
          <th>Benchmark</th>
          <th>Time (ms)</th>
          <th>Ops/sec</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
`;

      for (const bench of report.details.benchmarks) {
        const status = bench.avgTime < 100 ? '✅' : '⚠️';
        html += `
        <tr>
          <td>${bench.name}</td>
          <td>${bench.avgTime.toFixed(4)}</td>
          <td>${bench.opsPerSecond.toFixed(0)}</td>
          <td>${status}</td>
        </tr>
`;
      }

      html += `
      </tbody>
    </table>
  </div>
`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Get score color
   */
  private getScoreColor(score: number): string {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: string): string {
    const emojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️',
      info: '📝',
    };
    return emojis[severity as keyof typeof emojis] || '•';
  }
}

export default ReportGenerator;
