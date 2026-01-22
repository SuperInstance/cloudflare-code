/**
 * Test dashboard generator for ClaudeFlare
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { DashboardData, TestRun, TrendData } from '../utils/types';

/**
 * Dashboard generator
 */
export class DashboardGenerator {
  private data: DashboardData;

  constructor() {
    this.data = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        flaky: 0,
        passRate: 0
      },
      trends: [],
      performance: {
        requests: { total: 0, success: 0, failure: 0 },
        responseTime: { min: 0, max: 0, mean: 0, median: 0, p90: 0, p95: 0, p99: 0 },
        throughput: { requestsPerSecond: 0, bytesPerSecond: 0 },
        concurrency: { min: 0, max: 0, mean: 0 },
        errors: [],
        latency: []
      },
      security: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        total: 0,
        score: 100
      },
      coverage: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0
      },
      recentRuns: []
    };
  }

  /**
   * Update dashboard data
   */
  update(data: Partial<DashboardData>): void {
    this.data = { ...this.data, ...data };
  }

  /**
   * Add test run
   */
  addTestRun(run: TestRun): void {
    this.data.recentRuns.unshift(run);

    // Keep only last 20 runs
    if (this.data.recentRuns.length > 20) {
      this.data.recentRuns = this.data.recentRuns.slice(0, 20);
    }
  }

  /**
   * Add trend data point
   */
  addTrend(trend: TrendData): void {
    this.data.trends.push(trend);

    // Keep only last 30 days
    if (this.data.trends.length > 30) {
      this.data.trends = this.data.trends.slice(-30);
    }
  }

  /**
   * Generate dashboard HTML
   */
  generateHtml(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaudeFlare QA Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; }
    .container { max-width: 1600px; margin: 0 auto; padding: 20px; }
    .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header h1 { color: #333; margin-bottom: 10px; }
    .header .last-updated { color: #666; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .card { background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h2 { font-size: 18px; color: #333; margin-bottom: 20px; }
    .metric { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
    .metric:last-child { border-bottom: none; }
    .metric-label { color: #666; font-size: 14px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-value.passed { color: #10b981; }
    .metric-value.failed { color: #ef4444; }
    .metric-value.neutral { color: #3b82f6; }
    .chart-container { position: relative; height: 300px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th { text-align: left; padding: 12px; background: #f9fafb; font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; }
    .table td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    .table tr:last-child td { border-bottom: none; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .status-badge.passed { background: #d1fae5; color: #065f46; }
    .status-badge.failed { background: #fee2e2; color: #991b1b; }
    .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .progress-bar-fill { height: 100%; transition: width 0.3s; }
    .progress-bar-fill.passed { background: #10b981; }
    .progress-bar-fill.failed { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ClaudeFlare QA Dashboard</h1>
      <div class="last-updated">Last updated: ${new Date().toISOString()}</div>
    </div>

    <!-- Test Summary -->
    <div class="grid">
      <div class="card">
        <h2>Test Summary</h2>
        <div class="metric">
          <div class="metric-label">Total Tests</div>
          <div class="metric-value neutral">${this.data.summary.total}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Passed</div>
          <div class="metric-value passed">${this.data.summary.passed}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Failed</div>
          <div class="metric-value failed">${this.data.summary.failed}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Pass Rate</div>
          <div class="metric-value ${this.data.summary.passRate >= 0.9 ? 'passed' : 'failed'}">
            ${(this.data.summary.passRate * 100).toFixed(1)}%
          </div>
        </div>
        <div class="progress-bar" style="margin-top: 20px;">
          <div class="progress-bar-fill passed" style="width: ${(this.data.summary.passRate * 100).toFixed(1)}%"></div>
        </div>
      </div>

      <!-- Coverage -->
      <div class="card">
        <h2>Code Coverage</h2>
        <div class="metric">
          <div class="metric-label">Lines</div>
          <div class="metric-value neutral">${this.data.coverage.lines.toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Functions</div>
          <div class="metric-value neutral">${this.data.coverage.functions.toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Branches</div>
          <div class="metric-value neutral">${this.data.coverage.branches.toFixed(1)}%</div>
        </div>
        <div class="metric">
          <div class="metric-label">Statements</div>
          <div class="metric-value neutral">${this.data.coverage.statements.toFixed(1)}%</div>
        </div>
      </div>

      <!-- Security -->
      <div class="card">
        <h2>Security Score</h2>
        <div style="text-align: center; padding: 20px 0;">
          <div style="font-size: 48px; font-weight: bold; color: ${this.data.security.score >= 80 ? '#10b981' : this.data.security.score >= 50 ? '#f59e0b' : '#ef4444'};">
            ${this.data.security.score}
          </div>
        </div>
        <div class="metric">
          <div class="metric-label">Critical</div>
          <div class="metric-value failed">${this.data.security.critical}</div>
        </div>
        <div class="metric">
          <div class="metric-label">High</div>
          <div class="metric-value failed">${this.data.security.high}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Medium</div>
          <div class="metric-value neutral">${this.data.security.medium}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Total</div>
          <div class="metric-value neutral">${this.data.security.total}</div>
        </div>
      </div>

      <!-- Performance -->
      <div class="card">
        <h2>Performance</h2>
        <div class="metric">
          <div class="metric-label">Avg Response Time</div>
          <div class="metric-value neutral">${this.data.performance.responseTime.mean.toFixed(0)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">P95 Response Time</div>
          <div class="metric-value neutral">${this.data.performance.responseTime.p95.toFixed(0)}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">Throughput</div>
          <div class="metric-value neutral">${this.data.performance.throughput.requestsPerSecond.toFixed(0)} req/s</div>
        </div>
        <div class="metric">
          <div class="metric-label">Error Rate</div>
          <div class="metric-value ${this.data.performance.requests.failure / this.data.performance.requests.total < 0.01 ? 'passed' : 'failed'}">
            ${((this.data.performance.requests.failure / this.data.performance.requests.total) * 100).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>

    <!-- Trends Chart -->
    <div class="card" style="margin-bottom: 20px;">
      <h2>Test Trends (Last 30 Days)</h2>
      <div class="chart-container">
        <canvas id="trendsChart"></canvas>
      </div>
    </div>

    <!-- Recent Runs -->
    <div class="card">
      <h2>Recent Test Runs</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Suite</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Pass Rate</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${this.data.recentRuns.map(run => `
            <tr>
              <td>${run.suite}</td>
              <td><span class="status-badge ${run.status}">${run.status}</span></td>
              <td>${Math.round(run.duration / 1000)}s</td>
              <td>${run.summary.passed}</td>
              <td>${run.summary.failed}</td>
              <td>${(run.summary.passRate * 100).toFixed(1)}%</td>
              <td>${new Date(run.timestamp).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const ctx = document.getElementById('trendsChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(this.data.trends.map(t => new Date(t.date).toLocaleDateString()))},
        datasets: [{
          label: 'Pass Rate',
          data: ${JSON.stringify(this.data.trends.map(t => t.passRate * 100))},
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'Duration (s)',
          data: ${JSON.stringify(this.data.trends.map(t => t.duration / 1000))},
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1'
        }, {
          label: 'Coverage (%)',
          data: ${JSON.stringify(this.data.trends.map(t => t.coverage))},
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y2'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            min: 0,
            max: 100,
            ticks: {
              callback: function(value) { return value + '%'; }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: function(value) { return value + 's'; }
            }
          },
          y2: {
            type: 'linear',
            display: false,
            min: 0,
            max: 100
          }
        }
      }
    });
  </script>
</body>
</html>
    `;
  }

  /**
   * Export dashboard to HTML
   */
  exportToHtml(outputPath: string): void {
    const html = this.generateHtml();

    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, html);
  }

  /**
   * Export dashboard data to JSON
   */
  exportToJson(outputPath: string): void {
    const dir = join(outputPath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(outputPath, JSON.stringify(this.data, null, 2));
  }
}
