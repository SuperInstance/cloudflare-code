/**
 * Test reporting system for ClaudeFlare
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type {
  TestReport,
  TestSuite,
  TestResult,
  PerformanceTestResult,
  SecurityTestResult,
  DashboardData
} from '../utils/types';

/**
 * Main test reporter
 */
export class TestReporter {
  private suites: TestSuite[] = [];
  private metadata: Map<string, unknown> = new Map();

  /**
   * Add a test suite
   */
  addSuite(suite: TestSuite): void {
    this.suites.push(suite);
  }

  /**
   * Add metadata
   */
  setMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  /**
   * Generate test report
   */
  generateReport(): TestReport {
    const summary = this.calculateSummary();

    return {
      suite: 'ClaudeFlare QA Tests',
      timestamp: new Date(),
      duration: this.suites.reduce((sum, s) => sum + s.duration, 0),
      suites: this.suites,
      summary,
      environment: {
        baseUrl: 'http://localhost:8787',
        apiBaseUrl: 'http://localhost:8787/api',
        timeout: 30000,
        retries: 3,
        parallel: true,
        environment: 'development'
      },
      metadata: Object.fromEntries(this.metadata)
    };
  }

  /**
   * Calculate test summary
   */
  private calculateSummary() {
    const summary = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      flaky: 0,
      passRate: 0
    };

    for (const suite of this.suites) {
      summary.total += suite.tests.length;
      summary.passed += suite.passed;
      summary.failed += suite.failed;
      summary.skipped += suite.skipped;
      summary.flaky += suite.flaky;
    }

    summary.passRate = summary.total > 0 ? summary.passed / summary.total : 0;

    return summary;
  }

  /**
   * Export report to JSON
   */
  exportToJson(outputPath: string): void {
    const report = this.generateReport();
    const dir = join(outputPath, '..');

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  /**
   * Export report to HTML
   */
  exportToHtml(outputPath: string): void {
    const report = this.generateReport();
    const html = this.generateHtmlReport(report);

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, html);
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: TestReport): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaudeFlare Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header h1 { color: #333; margin-bottom: 10px; }
    .header .timestamp { color: #666; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-card h3 { color: #666; font-size: 14px; margin-bottom: 10px; }
    .summary-card .value { font-size: 32px; font-weight: bold; }
    .summary-card.passed .value { color: #10b981; }
    .summary-card.failed .value { color: #ef4444; }
    .summary-card.skipped .value { color: #f59e0b; }
    .summary-card.duration .value { color: #3b82f6; }
    .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 20px; }
    .progress-bar .passed { height: 100%; background: #10b981; transition: width 0.3s; }
    .progress-bar .failed { height: 100%; background: #ef4444; transition: width 0.3s; }
    .progress-bar .skipped { height: 100%; background: #f59e0b; transition: width 0.3s; }
    .suites { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
    .suite { border-bottom: 1px solid #e5e7eb; }
    .suite:last-child { border-bottom: none; }
    .suite-header { padding: 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
    .suite-header:hover { background: #f9fafb; }
    .suite-name { font-weight: 600; color: #333; }
    .suite-stats { display: flex; gap: 20px; }
    .suite-stat { font-size: 14px; }
    .suite-stat.passed { color: #10b981; }
    .suite-stat.failed { color: #ef4444; }
    .suite-stat.skipped { color: #f59e0b; }
    .tests { padding: 0 20px 20px; display: none; }
    .tests.open { display: block; }
    .test { padding: 10px; border-left: 3px solid #e5e7eb; margin-bottom: 10px; background: #f9fafb; }
    .test.passed { border-left-color: #10b981; }
    .test.failed { border-left-color: #ef4444; }
    .test.skipped { border-left-color: #f59e0b; }
    .test-name { font-weight: 500; margin-bottom: 5px; }
    .test-error { color: #ef4444; font-size: 14px; margin-top: 5px; }
    .test-duration { color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ClaudeFlare Test Report</h1>
      <div class="timestamp">Generated: ${report.timestamp.toISOString()}</div>
    </div>

    <div class="summary">
      <div class="summary-card passed">
        <h3>Passed</h3>
        <div class="value">${report.summary.passed}</div>
      </div>
      <div class="summary-card failed">
        <h3>Failed</h3>
        <div class="value">${report.summary.failed}</div>
      </div>
      <div class="summary-card skipped">
        <h3>Skipped</h3>
        <div class="value">${report.summary.skipped}</div>
      </div>
      <div class="summary-card duration">
        <h3>Duration</h3>
        <div class="value">${Math.round(report.duration / 1000)}s</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="passed" style="width: ${(report.summary.passRate * 100).toFixed(1)}%"></div>
    </div>

    <div class="suites">
      ${report.suites.map(suite => `
        <div class="suite">
          <div class="suite-header" onclick="toggleSuite(this)">
            <div class="suite-name">${suite.name}</div>
            <div class="suite-stats">
              <div class="suite-stat passed">${suite.passed} passed</div>
              <div class="suite-stat failed">${suite.failed} failed</div>
              <div class="suite-stat skipped">${suite.skipped} skipped</div>
            </div>
          </div>
          <div class="tests">
            ${suite.tests.map(test => `
              <div class="test ${test.status}">
                <div class="test-name">${test.name}</div>
                ${test.error ? `<div class="test-error">${test.error.message}</div>` : ''}
                <div class="test-duration">${test.duration}ms</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    function toggleSuite(header) {
      const tests = header.nextElementSibling;
      tests.classList.toggle('open');
    }
  </script>
</body>
</html>
    `;
  }
}

/**
 * Coverage reporter
 */
export class CoverageReporter {
  private coverage: Map<string, any> = new Map();

  /**
   * Add coverage data
   */
  addCoverage(file: string, data: any): void {
    this.coverage.set(file, data);
  }

  /**
   * Generate coverage summary
   */
  generateSummary() {
    const summary = {
      lines: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
      statements: { total: 0, covered: 0, percentage: 0 }
    };

    for (const [, data] of this.coverage) {
      summary.lines.total += data.lines?.total || 0;
      summary.lines.covered += data.lines?.covered || 0;
      summary.functions.total += data.functions?.total || 0;
      summary.functions.covered += data.functions?.covered || 0;
      summary.branches.total += data.branches?.total || 0;
      summary.branches.covered += data.branches?.covered || 0;
      summary.statements.total += data.statements?.total || 0;
      summary.statements.covered += data.statements?.covered || 0;
    }

    summary.lines.percentage = summary.lines.total > 0
      ? (summary.lines.covered / summary.lines.total) * 100
      : 0;
    summary.functions.percentage = summary.functions.total > 0
      ? (summary.functions.covered / summary.functions.total) * 100
      : 0;
    summary.branches.percentage = summary.branches.total > 0
      ? (summary.branches.covered / summary.branches.total) * 100
      : 0;
    summary.statements.percentage = summary.statements.total > 0
      ? (summary.statements.covered / summary.statements.total) * 100
      : 0;

    return summary;
  }

  /**
   * Export coverage to JSON
   */
  exportToJson(outputPath: string): void {
    const summary = this.generateSummary();
    const coverageData = Object.fromEntries(this.coverage);

    const data = {
      summary,
      files: coverageData
    };

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }

  /**
   * Export coverage to HTML
   */
  exportToHtml(outputPath: string): void {
    const summary = this.generateSummary();
    const html = this.generateHtmlReport(summary);

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, html);
  }

  /**
   * Generate HTML coverage report
   */
  private generateHtmlReport(summary: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaudeFlare Coverage Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header h1 { color: #333; margin-bottom: 20px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .metric { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric-label { color: #666; font-size: 14px; margin-bottom: 10px; }
    .metric-value { font-size: 32px; font-weight: bold; }
    .metric-value.high { color: #10b981; }
    .metric-value.medium { color: #f59e0b; }
    .metric-value.low { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ClaudeFlare Coverage Report</h1>
    </div>

    <div class="metrics">
      <div class="metric">
        <div class="metric-label">Lines</div>
        <div class="metric-value ${this.getCoverageClass(summary.lines.percentage)}">
          ${summary.lines.percentage.toFixed(1)}%
        </div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">
          ${summary.lines.covered} / ${summary.lines.total}
        </div>
      </div>

      <div class="metric">
        <div class="metric-label">Functions</div>
        <div class="metric-value ${this.getCoverageClass(summary.functions.percentage)}">
          ${summary.functions.percentage.toFixed(1)}%
        </div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">
          ${summary.functions.covered} / ${summary.functions.total}
        </div>
      </div>

      <div class="metric">
        <div class="metric-label">Branches</div>
        <div class="metric-value ${this.getCoverageClass(summary.branches.percentage)}">
          ${summary.branches.percentage.toFixed(1)}%
        </div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">
          ${summary.branches.covered} / ${summary.branches.total}
        </div>
      </div>

      <div class="metric">
        <div class="metric-label">Statements</div>
        <div class="metric-value ${this.getCoverageClass(summary.statements.percentage)}">
          ${summary.statements.percentage.toFixed(1)}%
        </div>
        <div style="font-size: 14px; color: #666; margin-top: 5px;">
          ${summary.statements.covered} / ${summary.statements.total}
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Get coverage class based on percentage
   */
  private getCoverageClass(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 50) return 'medium';
    return 'low';
  }
}

/**
 * Performance reporter
 */
export class PerformanceReporter {
  private results: PerformanceTestResult[] = [];

  /**
   * Add performance result
   */
  addResult(result: PerformanceTestResult): void {
    this.results.push(result);
  }

  /**
   * Generate performance summary
   */
  generateSummary() {
    if (this.results.length === 0) {
      return null;
    }

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    // Aggregate metrics
    const allMetrics = this.results.map(r => r.metrics);
    const avgResponseTime = allMetrics.reduce((sum, m) => sum + m.responseTime.mean, 0) / allMetrics.length;
    const maxResponseTime = Math.max(...allMetrics.map(m => m.responseTime.p99));
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requests.total, 0);
    const totalErrors = allMetrics.reduce((sum, m) => sum + m.requests.failure, 0);

    return {
      totalTests: this.results.length,
      passed,
      failed,
      passRate: passed / this.results.length,
      totalDuration,
      avgResponseTime,
      maxResponseTime,
      totalRequests,
      totalErrors,
      errorRate: totalErrors / totalRequests
    };
  }

  /**
   * Export performance report
   */
  exportToJson(outputPath: string): void {
    const summary = this.generateSummary();
    const data = {
      summary,
      results: this.results
    };

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }
}

/**
 * Security reporter
 */
export class SecurityReporter {
  private result: SecurityTestResult | null = null;

  /**
   * Set security result
   */
  setResult(result: SecurityTestResult): void {
    this.result = result;
  }

  /**
   * Export security report
   */
  exportToJson(outputPath: string): void {
    if (!this.result) {
      return;
    }

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(this.result, null, 2));
  }

  /**
   * Export security report to HTML
   */
  exportToHtml(outputPath: string): void {
    if (!this.result) {
      return;
    }

    const html = this.generateHtmlReport(this.result);

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, html);
  }

  /**
   * Generate HTML security report
   */
  private generateHtmlReport(result: SecurityTestResult): string {
    const summary = result.summary;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaudeFlare Security Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header h1 { color: #333; margin-bottom: 10px; }
    .score { font-size: 48px; font-weight: bold; margin: 20px 0; }
    .score.high { color: #10b981; }
    .score.medium { color: #f59e0b; }
    .score.low { color: #ef4444; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .summary-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .summary-card.critical { border-left: 4px solid #dc2626; }
    .summary-card.high { border-left: 4px solid #ef4444; }
    .summary-card.medium { border-left: 4px solid #f59e0b; }
    .summary-card.low { border-left: 4px solid #10b981; }
    .summary-card h3 { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 10px; }
    .summary-card .count { font-size: 32px; font-weight: bold; }
    .vulnerabilities { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
    .vulnerability { padding: 20px; border-bottom: 1px solid #e5e7eb; }
    .vulnerability:last-child { border-bottom: none; }
    .vuln-header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px; }
    .vuln-title { font-weight: 600; color: #333; }
    .vuln-severity { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .vuln-severity.critical { background: #dc2626; color: white; }
    .vuln-severity.high { background: #ef4444; color: white; }
    .vuln-severity.medium { background: #f59e0b; color: white; }
    .vuln-severity.low { background: #10b981; color: white; }
    .vuln-description { color: #666; margin-bottom: 10px; }
    .vuln-location { color: #666; font-size: 14px; margin-bottom: 10px; }
    .vuln-remediation { background: #f0fdf4; padding: 10px; border-radius: 4px; border-left: 3px solid #10b981; }
    .vuln-remediation-label { font-weight: 600; color: #166534; margin-bottom: 5px; }
    .vuln-remediation-text { color: #166534; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ClaudeFlare Security Report</h1>
      <div style="color: #666;">Generated: ${result.timestamp.toISOString()}</div>
      <div class="score ${summary.score >= 80 ? 'high' : summary.score >= 50 ? 'medium' : 'low'}">
        Security Score: ${summary.score}/100
      </div>
    </div>

    <div class="summary">
      <div class="summary-card critical">
        <h3>Critical</h3>
        <div class="count">${summary.critical}</div>
      </div>
      <div class="summary-card high">
        <h3>High</h3>
        <div class="count">${summary.high}</div>
      </div>
      <div class="summary-card medium">
        <h3>Medium</h3>
        <div class="count">${summary.medium}</div>
      </div>
      <div class="summary-card low">
        <h3>Low</h3>
        <div class="count">${summary.low}</div>
      </div>
    </div>

    <div class="vulnerabilities">
      ${result.vulnerabilities.map(vuln => `
        <div class="vulnerability">
          <div class="vuln-header">
            <div class="vuln-title">${vuln.title}</div>
            <div class="vuln-severity ${vuln.severity}">${vuln.severity}</div>
          </div>
          <div class="vuln-description">${vuln.description}</div>
          <div class="vuln-location">Location: ${vuln.location}</div>
          ${vuln.remediation ? `
            <div class="vuln-remediation">
              <div class="vuln-remediation-label">Remediation:</div>
              <div class="vuln-remediation-text">${vuln.remediation}</div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
  </div>
</body>
</html>
    `;
  }
}
